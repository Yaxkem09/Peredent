using Peredent.Api.DTOs.Request;

namespace Peredent.Api.Services;

public interface IWhatsAppWebhookService
{
    // Procesa una notificación del webhook de WhatsApp cuya firma ya fue
    // validada (respuestas a los botones del recordatorio, cambios de estado).
    Task ProcesarAsync(WhatsAppWebhookPayload payload, CancellationToken ct);
}
