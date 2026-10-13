namespace Peredent.Api.Options;

public class WhatsAppOptions
{
    public bool Enabled { get; set; }
    public string ApiVersion { get; set; } = "v25.0";
    public string PhoneNumberId { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
    public string TemplateName { get; set; } = "recordatorio_cita";
    public string TemplateLanguage { get; set; } = "es";

    // Webhook (respuestas de los pacientes). No son obligatorios al arrancar:
    // si faltan, el webhook rechaza todo y lo registra en el log.
    public string AppSecret { get; set; } = string.Empty;
    public string WebhookVerifyToken { get; set; } = string.Empty;
}
