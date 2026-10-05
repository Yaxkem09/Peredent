using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.Models;

namespace Peredent.Api.Services;

// SCRUM-231 a 236: recuperación de contraseña olvidada.
// Decisiones del ticket:
//  - la respuesta es SIEMPRE la misma, exista o no la cuenta (anti-enumeración);
//  - el token real solo viaja en el correo: en la base queda su hash SHA-256;
//  - dura 30 minutos y es de un solo uso;
//  - un pedido nuevo invalida los pendientes y hay topes anti-abuso;
//  - la contraseña nueva se guarda con bcrypt y cumple PoliticaContrasena.
public class RecuperacionContrasenaService : IRecuperacionContrasenaService
{
    private const int MinutosVigencia = 30;
    private const int SegundosEntreSolicitudes = 60;
    private const int MaximoSolicitudesPorHora = 5;
    private const string Asunto = "Restablece tu contraseña de Peredent";

    // Mismo texto para todos los casos: no revela si la cuenta existe, si está
    // activa o si tiene correo (SCRUM-233).
    public const string MensajeGenerico =
        "Si el correo o usuario está registrado, recibirás las instrucciones para restablecer tu contraseña.";

    // Mismo texto para token inexistente, usado o expirado (SCRUM-234).
    public const string MensajeTokenInvalido = "El enlace no es válido o ya expiró. Solicita uno nuevo.";

    private readonly ApplicationDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IEmailSender _emailSender;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RecuperacionContrasenaService> _logger;

    public RecuperacionContrasenaService(
        ApplicationDbContext db,
        IPasswordHasher passwordHasher,
        IEmailSender emailSender,
        IConfiguration configuration,
        ILogger<RecuperacionContrasenaService> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _emailSender = emailSender;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string> SolicitarAsync(string identificador)
    {
        var usuario = await BuscarUsuarioAsync(identificador);

        // Solo se envía a cuentas activas y con correo registrado; en cualquier otro
        // caso se responde lo mismo (y no se envía nada).
        if (usuario is null || !usuario.Estado || string.IsNullOrWhiteSpace(usuario.CorreoUsuario))
        {
            return MensajeGenerico;
        }

        if (!await PuedeSolicitarAsync(usuario.IdUsuario))
        {
            return MensajeGenerico;
        }

        // Un pedido nuevo invalida los pendientes: el enlace anterior deja de servir.
        await InvalidarPendientesAsync(usuario.IdUsuario);

        var token = GenerarToken();
        _db.ResetPasswords.Add(new ResetPassword
        {
            IdUsuario = usuario.IdUsuario,
            TokenRestablecer = HashToken(token),
            FechaCreacion = DateTime.UtcNow,
            FechaExpiracion = DateTime.UtcNow.AddMinutes(MinutosVigencia),
            TokenUsado = false,
        });
        await _db.SaveChangesAsync();

        await EnviarCorreoAsync(usuario, token);

        return MensajeGenerico;
    }

    public async Task<bool> TokenEsValidoAsync(string token)
    {
        var registro = await BuscarTokenAsync(token);
        return EsVigente(registro);
    }

    public async Task<RecuperacionResultado> RestablecerAsync(string token, string nuevaContrasena, string confirmacion)
    {
        var registro = await BuscarTokenAsync(token);
        if (!EsVigente(registro))
        {
            // Mismo mensaje para inexistente, usado o expirado (SCRUM-234).
            return RecuperacionResultado.Falla(RecuperacionError.TokenInvalido, MensajeTokenInvalido);
        }

        if (!string.Equals(nuevaContrasena, confirmacion, StringComparison.Ordinal))
        {
            return RecuperacionResultado.Falla(RecuperacionError.ContrasenasNoCoinciden, "Las contraseñas no coinciden.");
        }

        var errorPolitica = PoliticaContrasena.Validar(nuevaContrasena);
        if (errorPolitica is not null)
        {
            return RecuperacionResultado.Falla(RecuperacionError.PoliticaContrasena, errorPolitica);
        }

        var usuario = await _db.Usuarios.FirstOrDefaultAsync(u => u.IdUsuario == registro!.IdUsuario);
        if (usuario is null)
        {
            return RecuperacionResultado.Falla(RecuperacionError.TokenInvalido, MensajeTokenInvalido);
        }

        // SCRUM-234: la contraseña nueva se guarda con bcrypt (Salt vacío).
        usuario.ContrasenaHash = _passwordHasher.Hashear(nuevaContrasena);
        usuario.Salt = string.Empty;

        // SCRUM-236: el enlace queda invalidado (todos los pendientes de ese usuario).
        await InvalidarPendientesAsync(usuario.IdUsuario);
        await _db.SaveChangesAsync();

        return RecuperacionResultado.Ok("Tu contraseña se cambió correctamente. Ya puedes iniciar sesión con la nueva.");
    }

    // El identificador puede ser el nombre de usuario o el correo.
    private Task<Usuario?> BuscarUsuarioAsync(string identificador)
    {
        var valor = (identificador ?? string.Empty).Trim();
        var correo = valor.ToLowerInvariant();

        return _db.Usuarios.FirstOrDefaultAsync(u => u.NombreUsuario == valor || u.CorreoUsuario == correo);
    }

    private Task<ResetPassword?> BuscarTokenAsync(string token)
    {
        var hash = HashToken(token ?? string.Empty);
        return _db.ResetPasswords.FirstOrDefaultAsync(t => t.TokenRestablecer == hash);
    }

    private static bool EsVigente(ResetPassword? registro) =>
        registro is not null && !registro.TokenUsado && registro.FechaExpiracion > DateTime.UtcNow;

    // Topes anti-abuso (SCRUM-233): un minuto entre pedidos y 5 por hora.
    private async Task<bool> PuedeSolicitarAsync(int idUsuario)
    {
        var ultima = await _db.ResetPasswords
            .Where(t => t.IdUsuario == idUsuario)
            .OrderByDescending(t => t.FechaCreacion)
            .Select(t => (DateTime?)t.FechaCreacion)
            .FirstOrDefaultAsync();

        if (ultima is not null && ultima > DateTime.UtcNow.AddSeconds(-SegundosEntreSolicitudes))
        {
            return false;
        }

        var enLaUltimaHora = await _db.ResetPasswords
            .CountAsync(t => t.IdUsuario == idUsuario && t.FechaCreacion >= DateTime.UtcNow.AddHours(-1));

        return enLaUltimaHora < MaximoSolicitudesPorHora;
    }

    // Marca como usados los tokens pendientes. El guardado lo hace el llamador, para
    // que el alta del token nuevo y la invalidación de los viejos sean una sola
    // operación.
    private async Task InvalidarPendientesAsync(int idUsuario)
    {
        var pendientes = await _db.ResetPasswords
            .Where(t => t.IdUsuario == idUsuario && !t.TokenUsado)
            .ToListAsync();

        foreach (var pendiente in pendientes)
        {
            pendiente.TokenUsado = true;
        }
    }

    // SCRUM-232: 32 bytes aleatorios en base64url, apto para viajar en una URL.
    private static string GenerarToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    // En la base solo queda el hash: leer la tabla no permite usar el enlace.
    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private async Task EnviarCorreoAsync(Usuario usuario, string token)
    {
        var baseUrl = (_configuration["FRONTEND_BASE_URL"] ?? "http://localhost:5173").TrimEnd('/');
        var enlace = $"{baseUrl}/restablecer-contrasena?token={Uri.EscapeDataString(token)}";
        var (html, texto) = ArmarPlantilla(usuario.NombreUsuario, enlace);

        try
        {
            await _emailSender.EnviarAsync(usuario.CorreoUsuario!, Asunto, html, texto);
        }
        catch (Exception ex)
        {
            // Un fallo de envío no cambia la respuesta ni deja el token en el log.
            _logger.LogError(ex, "No se pudo enviar el correo de restablecimiento al usuario {IdUsuario}.", usuario.IdUsuario);
        }
    }

    private static (string Html, string Texto) ArmarPlantilla(string nombreUsuario, string enlace)
    {
        var texto =
            $"Hola {nombreUsuario},\n\n" +
            "Recibimos una solicitud para restablecer la contraseña de tu cuenta de Peredent.\n\n" +
            $"Abrí este enlace para elegir una contraseña nueva:\n{enlace}\n\n" +
            $"El enlace vence en {MinutosVigencia} minutos y solo se puede usar una vez.\n" +
            "Si no solicitaste el cambio, ignorá este correo: tu contraseña sigue igual.\n\n" +
            "Peredent";

        var html =
            "<div style=\"font-family:Arial,Helvetica,sans-serif;color:#0a264b;font-size:14px;line-height:1.5\">" +
            $"<p>Hola {nombreUsuario},</p>" +
            "<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de <strong>Peredent</strong>.</p>" +
            $"<p><a href=\"{enlace}\" style=\"display:inline-block;padding:10px 18px;background:#0a7d75;color:#ffffff;" +
            "text-decoration:none;border-radius:8px\">Elegir contraseña nueva</a></p>" +
            $"<p>El enlace vence en {MinutosVigencia} minutos y solo se puede usar una vez.</p>" +
            "<p>Si no solicitaste el cambio, ignorá este correo: tu contraseña sigue igual.</p>" +
            "<p style=\"color:#5b6b7f;font-size:12px\">Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>" +
            $"<span style=\"word-break:break-all\">{enlace}</span></p>" +
            "</div>";

        return (html, texto);
    }
}
