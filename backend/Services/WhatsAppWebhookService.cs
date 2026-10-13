using Peredent.Api.DTOs.Request;
using Peredent.Api.Helpers;

namespace Peredent.Api.Services;

// Por ahora solo registra lo que llega; el procesamiento de las respuestas
// ("Sí asistiré" / "Modificar mi cita") se implementa en el siguiente paso.
public class WhatsAppWebhookService : IWhatsAppWebhookService
{
    private readonly ILogger<WhatsAppWebhookService> _logger;

    public WhatsAppWebhookService(ILogger<WhatsAppWebhookService> logger)
    {
        _logger = logger;
    }

    public Task ProcesarAsync(WhatsAppWebhookPayload payload, CancellationToken ct)
    {
        var values = payload.Entry
            .SelectMany(e => e.Changes)
            .Select(c => c.Value)
            .OfType<WhatsAppWebhookValue>()
            .ToList();

        foreach (var mensaje in values.SelectMany(v => v.Messages))
        {
            _logger.LogInformation(
                "Webhook WhatsApp: mensaje {Tipo} de {Telefono} (responde a {ContextoId})",
                mensaje.Type, TelefonoWhatsApp.Enmascarar(mensaje.From), mensaje.Context?.Id);
        }

        foreach (var estado in values.SelectMany(v => v.Statuses))
        {
            _logger.LogInformation(
                "Webhook WhatsApp: estado {Estado} del mensaje {MessageId}", estado.Status, estado.Id);
        }

        return Task.CompletedTask;
    }
}
