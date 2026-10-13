using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Peredent.Api.Services;

// SCRUM-232: SMTP configurado por variables de entorno (SMTP_HOST, SMTP_PORT,
// SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_SECURITY). Producción es Somee: usuario
// y contraseña, remitente igual al usuario SMTP, puerto 25 o 26 sin SSL. En local
// se usa Mailpit (localhost:1025, sin autenticación).
// Sin SMTP_HOST o SMTP_FROM no se intenta enviar y NUNCA se falla hacia afuera.
public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _entorno;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration configuration, IHostEnvironment entorno, ILogger<SmtpEmailSender> logger)
    {
        _configuration = configuration;
        _entorno = entorno;
        _logger = logger;
    }

    public async Task EnviarAsync(string destinatario, string asunto, string cuerpoHtml, string cuerpoTexto)
    {
        var host = _configuration["SMTP_HOST"];
        var remitente = _configuration["SMTP_FROM"];

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(remitente))
        {
            // Sin SMTP configurado: en Development el cuerpo queda en la consola del
            // backend para poder copiar el enlace; en cualquier otro entorno solo se
            // advierte, sin el enlace ni el contenido.
            if (_entorno.IsDevelopment())
            {
                _logger.LogWarning(
                    "SMTP no configurado: el correo para {Destinatario} no se envió. Contenido en texto plano:\n{Cuerpo}",
                    destinatario,
                    cuerpoTexto);
            }
            else
            {
                _logger.LogWarning("SMTP no configurado: no se pudo enviar el correo a {Destinatario}.", destinatario);
            }

            return;
        }

        var puerto = int.TryParse(_configuration["SMTP_PORT"], out var puertoConfigurado) ? puertoConfigurado : 25;
        var usuario = _configuration["SMTP_USER"];
        var password = _configuration["SMTP_PASSWORD"] ?? string.Empty;

        var mensaje = new MimeMessage();
        mensaje.From.Add(InternetAddress.Parse(remitente));
        mensaje.To.Add(InternetAddress.Parse(destinatario));
        mensaje.Subject = asunto;
        mensaje.Body = new BodyBuilder { HtmlBody = cuerpoHtml, TextBody = cuerpoTexto }.ToMessageBody();

        using var cliente = new SmtpClient();
        await cliente.ConnectAsync(host, puerto, OpcionesSeguridad(_configuration["SMTP_SECURITY"]));

        // Solo se autentica si hay usuario: Mailpit local no pide credenciales.
        if (!string.IsNullOrWhiteSpace(usuario))
        {
            await cliente.AuthenticateAsync(usuario, password);
        }

        await cliente.SendAsync(mensaje);
        await cliente.DisconnectAsync(true);
    }

    // none (por defecto, el caso de Somee en 25/26 y de Mailpit), starttls o ssl.
    private static SecureSocketOptions OpcionesSeguridad(string? seguridad) =>
        (seguridad ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "starttls" => SecureSocketOptions.StartTls,
            "ssl" => SecureSocketOptions.SslOnConnect,
            _ => SecureSocketOptions.None,
        };
}
