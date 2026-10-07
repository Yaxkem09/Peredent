using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Peredent.Api.Controllers;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Controllers;

// SCRUM-231 a 236: recuperación de contraseña olvidada.
public class RecuperacionContrasenaControllerTests
{
    private const string ClaveNueva = "ClaveNueva123";

    // IEmailSender falso: guarda lo enviado y permite simular una caída de SMTP.
    private sealed class EmailSenderFalso : IEmailSender
    {
        public List<(string Destinatario, string Asunto, string Html, string Texto)> Enviados { get; } = new();

        public bool Fallar { get; set; }

        public Task EnviarAsync(string destinatario, string asunto, string cuerpoHtml, string cuerpoTexto)
        {
            if (Fallar)
            {
                throw new InvalidOperationException("SMTP caído");
            }

            Enviados.Add((destinatario, asunto, cuerpoHtml, cuerpoTexto));
            return Task.CompletedTask;
        }
    }

    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static IConfiguration CrearConfiguracion(string frontendBaseUrl = "http://localhost:5173") =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["FRONTEND_BASE_URL"] = frontendBaseUrl })
            .Build();

    private static RecuperacionContrasenaController CrearController(
        ApplicationDbContext db, EmailSenderFalso email, IConfiguration? configuracion = null)
    {
        var servicio = new RecuperacionContrasenaService(
            db,
            new PasswordHasher(),
            email,
            configuracion ?? CrearConfiguracion(),
            NullLogger<RecuperacionContrasenaService>.Instance);

        return new RecuperacionContrasenaController(servicio);
    }

    private static async Task<Usuario> CrearUsuarioAsync(
        ApplicationDbContext db, string nombreUsuario = "dra.solis", string? correo = "dra.solis@peredent.local", bool estado = true)
    {
        var hasher = new PasswordHasher();
        var usuario = new Usuario
        {
            NombreUsuario = nombreUsuario,
            CorreoUsuario = correo,
            Salt = string.Empty,
            ContrasenaHash = hasher.Hashear("ClaveVieja123"),
            Estado = estado,
        };

        db.Usuarios.Add(usuario);
        await db.SaveChangesAsync();
        return usuario;
    }

    private static async Task AgregarTokenAsync(
        ApplicationDbContext db, int idUsuario, string token, DateTime creado, DateTime expira, bool usado = false)
    {
        db.ResetPasswords.Add(new ResetPassword
        {
            IdUsuario = idUsuario,
            TokenRestablecer = HashSha256(token),
            FechaCreacion = creado,
            FechaExpiracion = expira,
            TokenUsado = usado,
        });

        await db.SaveChangesAsync();
    }

    private static string HashSha256(string valor) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(valor))).ToLowerInvariant();

    // El token real solo existe dentro del enlace del correo.
    private static string TokenDelEnlace(EmailSenderFalso email)
    {
        var enlace = Regex.Match(email.Enviados[^1].Texto, @"https?://\S+").Value;
        var token = Regex.Match(enlace, @"[?&]token=([^&\s]+)").Groups[1].Value;
        return Uri.UnescapeDataString(token);
    }

    // Los mensajes viajan como { message = "..." }; el controller los devuelve anónimos.
    private static string MensajeDe(object? valor)
    {
        var propiedad = valor!.GetType().GetProperty("message");
        return (string)propiedad!.GetValue(valor)!;
    }

    [Fact]
    public async Task Solicitar_ConCorreo_GuardaSoloElHashYEnviaElEnlace()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        var email = new EmailSenderFalso();
        var controller = CrearController(db, email);

        var resultado = await controller.Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis@peredent.local" });

        var ok = Assert.IsType<OkObjectResult>(resultado);
        Assert.Equal(RecuperacionContrasenaService.MensajeGenerico, MensajeDe(ok.Value));

        var correo = Assert.Single(email.Enviados);
        Assert.Equal("dra.solis@peredent.local", correo.Destinatario);
        Assert.Equal("Restablece tu contraseña de Peredent", correo.Asunto);
        Assert.Contains("30 minutos", correo.Texto);
        Assert.Contains("ignorá este correo", correo.Texto);

        var token = TokenDelEnlace(email);
        Assert.Contains($"/restablecer-contrasena?token={token}", correo.Texto);

        // En la base queda el hash, nunca el token del enlace.
        var registro = await db.ResetPasswords.SingleAsync();
        Assert.Equal(usuario.IdUsuario, registro.IdUsuario);
        Assert.NotEqual(token, registro.TokenRestablecer);
        Assert.Equal(HashSha256(token), registro.TokenRestablecer);
        Assert.False(registro.TokenUsado);
        Assert.InRange(registro.FechaExpiracion, DateTime.UtcNow.AddMinutes(29), DateTime.UtcNow.AddMinutes(30).AddSeconds(5));
        Assert.InRange(registro.FechaCreacion, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(1));
    }

    // La recuperación es solo por correo: con el nombre de usuario responde el
    // mensaje genérico, pero no envía nada.
    [Fact]
    public async Task Solicitar_ConNombreDeUsuario_NoEnviaElEnlace()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);
        var email = new EmailSenderFalso();

        var resultado = await CrearController(db, email).Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis" });

        Assert.IsType<OkObjectResult>(resultado);
        Assert.Empty(email.Enviados);
        Assert.Empty(await db.ResetPasswords.ToListAsync());
    }

    [Theory]
    [InlineData("no.existe@peredent.local")]   // cuenta inexistente
    [InlineData("")]                            // sin dato
    public async Task Solicitar_CuentaInexistente_RespondeIgualYSinCorreo(string identificador)
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);
        var email = new EmailSenderFalso();

        var resultado = await CrearController(db, email).Solicitar(new OlvideContrasenaDto { Identificador = identificador });

        var ok = Assert.IsType<OkObjectResult>(resultado);
        Assert.Equal(RecuperacionContrasenaService.MensajeGenerico, MensajeDe(ok.Value));
        Assert.Empty(email.Enviados);
        Assert.Empty(await db.ResetPasswords.ToListAsync());
    }

    [Fact]
    public async Task Solicitar_CuentaInactiva_RespondeIgualYSinCorreo()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db, estado: false);
        var email = new EmailSenderFalso();

        var resultado = await CrearController(db, email).Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis@peredent.local" });

        var ok = Assert.IsType<OkObjectResult>(resultado);
        Assert.Equal(RecuperacionContrasenaService.MensajeGenerico, MensajeDe(ok.Value));
        Assert.Empty(email.Enviados);
    }

    [Fact]
    public async Task Solicitar_CuentaSinCorreo_RespondeIgualYSinCorreo()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db, correo: null);
        var email = new EmailSenderFalso();

        var resultado = await CrearController(db, email).Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis@peredent.local" });

        var ok = Assert.IsType<OkObjectResult>(resultado);
        Assert.Equal(RecuperacionContrasenaService.MensajeGenerico, MensajeDe(ok.Value));
        Assert.Empty(email.Enviados);
        Assert.Empty(await db.ResetPasswords.ToListAsync());
    }

    [Fact]
    public async Task Solicitar_DosVecesEnMenosDeUnMinuto_NoGeneraOtroToken()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        await AgregarTokenAsync(db, usuario.IdUsuario, "token-vigente", DateTime.UtcNow.AddSeconds(-10), DateTime.UtcNow.AddMinutes(20));
        var email = new EmailSenderFalso();

        var resultado = await CrearController(db, email).Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis" });

        Assert.IsType<OkObjectResult>(resultado);
        Assert.Empty(email.Enviados);
        Assert.Single(await db.ResetPasswords.ToListAsync());
    }

    [Fact]
    public async Task Solicitar_ConCincoTokensEnLaUltimaHora_NoGeneraOtro()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        for (var i = 0; i < 5; i++)
        {
            // Separados para no chocar con el tope de un minuto entre pedidos.
            await AgregarTokenAsync(
                db, usuario.IdUsuario, $"token-{i}", DateTime.UtcNow.AddMinutes(-50 + i * 5), DateTime.UtcNow.AddMinutes(-20));
        }
        var email = new EmailSenderFalso();

        var resultado = await CrearController(db, email).Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis" });

        Assert.IsType<OkObjectResult>(resultado);
        Assert.Empty(email.Enviados);
        Assert.Equal(5, await db.ResetPasswords.CountAsync());
    }

    [Fact]
    public async Task Solicitar_UnoNuevoInvalidaElAnterior()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        await AgregarTokenAsync(db, usuario.IdUsuario, "token-viejo", DateTime.UtcNow.AddMinutes(-10), DateTime.UtcNow.AddMinutes(20));
        var email = new EmailSenderFalso();
        var controller = CrearController(db, email);

        await controller.Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis@peredent.local" });

        var viejo = await db.ResetPasswords.SingleAsync(t => t.TokenRestablecer == HashSha256("token-viejo"));
        Assert.True(viejo.TokenUsado);

        var validacion = await controller.Validar(new ValidarTokenDto { Token = "token-viejo" });
        var ok = Assert.IsType<OkObjectResult>(validacion.Result);
        Assert.False(Assert.IsType<TokenValidadoDto>(ok.Value).Valido);
    }

    [Fact]
    public async Task Validar_TokenVigente_DevuelveTrue()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        await AgregarTokenAsync(db, usuario.IdUsuario, "token-vigente", DateTime.UtcNow, DateTime.UtcNow.AddMinutes(30));

        var resultado = await CrearController(db, new EmailSenderFalso())
            .Validar(new ValidarTokenDto { Token = "token-vigente" });

        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        Assert.True(Assert.IsType<TokenValidadoDto>(ok.Value).Valido);
    }

    [Theory]
    [InlineData("no-existe", 30, 0, false)]      // token inventado
    [InlineData("token-expirado", -1, 30, false)] // expirado
    [InlineData("token-usado", 30, 0, true)]      // ya usado
    public async Task Validar_TokenInvalidoExpiradoOUsado_DevuelveFalse(
        string token, int minutosHastaExpirar, int minutosDeVida, bool usado)
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        if (minutosDeVida > 0)
        {
            await AgregarTokenAsync(
                db, usuario.IdUsuario, token, DateTime.UtcNow.AddMinutes(-minutosDeVida), DateTime.UtcNow.AddMinutes(minutosHastaExpirar), usado);
        }

        var resultado = await CrearController(db, new EmailSenderFalso())
            .Validar(new ValidarTokenDto { Token = token });

        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        Assert.False(Assert.IsType<TokenValidadoDto>(ok.Value).Valido);
    }

    // SCRUM-234/235/236: cambio correcto, hash bcrypt y enlace invalidado.
    [Fact]
    public async Task Restablecer_TokenVigente_CambiaLaContrasenaEInvalidaElEnlace()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        var email = new EmailSenderFalso();
        var controller = CrearController(db, email);
        await controller.Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis@peredent.local" });
        var token = TokenDelEnlace(email);

        var resultado = await controller.Restablecer(new RestablecerContrasenaDto
        {
            Token = token,
            NuevaContrasena = ClaveNueva,
            Confirmacion = ClaveNueva,
        });

        var ok = Assert.IsType<OkObjectResult>(resultado);
        Assert.Contains("correctamente", MensajeDe(ok.Value));

        var hasher = new PasswordHasher();
        var guardado = await db.Usuarios.SingleAsync(u => u.IdUsuario == usuario.IdUsuario);
        Assert.StartsWith("$2", guardado.ContrasenaHash);
        Assert.Equal(60, guardado.ContrasenaHash.Length);
        Assert.Equal(string.Empty, guardado.Salt);
        Assert.True(hasher.Verificar(ClaveNueva, guardado.ContrasenaHash, guardado.Salt));
        Assert.False(hasher.Verificar("ClaveVieja123", guardado.ContrasenaHash, guardado.Salt));

        // El enlace queda de un solo uso.
        Assert.True((await db.ResetPasswords.SingleAsync()).TokenUsado);
        var segundoIntento = await controller.Restablecer(new RestablecerContrasenaDto
        {
            Token = token,
            NuevaContrasena = "OtraClave123",
            Confirmacion = "OtraClave123",
        });
        var malo = Assert.IsType<BadRequestObjectResult>(segundoIntento);
        Assert.Equal(RecuperacionContrasenaService.MensajeTokenInvalido, MensajeDe(malo.Value));
    }

    [Fact]
    public async Task Restablecer_ContrasenasNoCoinciden_Devuelve400YNoCambia()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        var email = new EmailSenderFalso();
        var controller = CrearController(db, email);
        await controller.Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis@peredent.local" });

        var resultado = await controller.Restablecer(new RestablecerContrasenaDto
        {
            Token = TokenDelEnlace(email),
            NuevaContrasena = ClaveNueva,
            Confirmacion = "OtraCosa123",
        });

        var malo = Assert.IsType<BadRequestObjectResult>(resultado);
        Assert.Contains("no coinciden", MensajeDe(malo.Value));
        var guardado = await db.Usuarios.SingleAsync(u => u.IdUsuario == usuario.IdUsuario);
        Assert.Equal(usuario.ContrasenaHash, guardado.ContrasenaHash);
    }

    [Theory]
    [InlineData("corta1")]          // menos de 8
    [InlineData("sinmayuscula1")]   // sin mayúscula
    [InlineData("SINMINUSCULA1")]   // sin minúscula
    [InlineData("SinNumeros")]      // sin número
    public async Task Restablecer_NoCumpleLaPolitica_Devuelve400(string clave)
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        var email = new EmailSenderFalso();
        var controller = CrearController(db, email);
        await controller.Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis@peredent.local" });

        var resultado = await controller.Restablecer(new RestablecerContrasenaDto
        {
            Token = TokenDelEnlace(email),
            NuevaContrasena = clave,
            Confirmacion = clave,
        });

        Assert.IsType<BadRequestObjectResult>(resultado);
        var guardado = await db.Usuarios.SingleAsync(u => u.IdUsuario == usuario.IdUsuario);
        Assert.Equal(usuario.ContrasenaHash, guardado.ContrasenaHash);
    }

    [Fact]
    public async Task Restablecer_TokenInvalido_DevuelveElMismoMensajeQueElExpirado()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        await AgregarTokenAsync(db, usuario.IdUsuario, "token-expirado", DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddMinutes(-30));
        var controller = CrearController(db, new EmailSenderFalso());

        var inexistente = await controller.Restablecer(new RestablecerContrasenaDto
        {
            Token = "no-existe", NuevaContrasena = ClaveNueva, Confirmacion = ClaveNueva,
        });
        var expirado = await controller.Restablecer(new RestablecerContrasenaDto
        {
            Token = "token-expirado", NuevaContrasena = ClaveNueva, Confirmacion = ClaveNueva,
        });

        Assert.Equal(
            MensajeDe(Assert.IsType<BadRequestObjectResult>(inexistente).Value),
            MensajeDe(Assert.IsType<BadRequestObjectResult>(expirado).Value));
    }

    // Un fallo de SMTP no puede cambiar la respuesta ni romper el flujo.
    [Fact]
    public async Task Solicitar_SiElEnvioFalla_LaRespuestaSigueSiendoLaGenerica()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);
        var email = new EmailSenderFalso { Fallar = true };

        var resultado = await CrearController(db, email).Solicitar(new OlvideContrasenaDto { Identificador = "dra.solis@peredent.local" });

        var ok = Assert.IsType<OkObjectResult>(resultado);
        Assert.Equal(RecuperacionContrasenaService.MensajeGenerico, MensajeDe(ok.Value));
        // El token se guardó igual (el usuario puede pedir otro cuando quiera).
        Assert.Single(await db.ResetPasswords.ToListAsync());
    }
}
