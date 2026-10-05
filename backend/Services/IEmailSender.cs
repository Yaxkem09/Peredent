namespace Peredent.Api.Services;

// SCRUM-232: envío de correo saliente. La implementación real usa SMTP (MailKit) y
// se configura por variables de entorno; si no hay SMTP configurado no falla: deja
// rastro en el log y el flujo de recuperación continúa igual.
public interface IEmailSender
{
    Task EnviarAsync(string destinatario, string asunto, string cuerpoHtml, string cuerpoTexto);
}
