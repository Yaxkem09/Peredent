using System.Text.Json.Serialization;

namespace Peredent.Api.DTOs.Request;

// Notificación que Meta envía al webhook de WhatsApp (POST /api/whatsapp/webhook).
// Solo se modelan los campos que usamos; System.Text.Json ignora los demás
// (conversation, pricing, etc.). Nombres JSON explícitos porque Meta usa snake_case.
//
// { "object": "whatsapp_business_account",
//   "entry": [ { "id": "...", "changes": [ { "field": "messages",
//     "value": { "messages": [...], "statuses": [...] } } ] } ] }
public class WhatsAppWebhookPayload
{
    [JsonPropertyName("object")]
    public string? Object { get; set; }

    [JsonPropertyName("entry")]
    public List<WhatsAppWebhookEntry> Entry { get; set; } = new();
}

public class WhatsAppWebhookEntry
{
    // ID de la cuenta de WhatsApp Business.
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("changes")]
    public List<WhatsAppWebhookChange> Changes { get; set; } = new();
}

public class WhatsAppWebhookChange
{
    // "messages" para mensajes entrantes y cambios de estado.
    [JsonPropertyName("field")]
    public string? Field { get; set; }

    [JsonPropertyName("value")]
    public WhatsAppWebhookValue? Value { get; set; }
}

public class WhatsAppWebhookValue
{
    [JsonPropertyName("messaging_product")]
    public string? MessagingProduct { get; set; }

    [JsonPropertyName("metadata")]
    public WhatsAppWebhookMetadata? Metadata { get; set; }

    // Mensajes entrantes del paciente (p. ej. el toque a un botón de respuesta rápida).
    [JsonPropertyName("messages")]
    public List<WhatsAppWebhookMessage> Messages { get; set; } = new();

    // Cambios de estado de mensajes que enviamos nosotros (sent, delivered, read, failed).
    [JsonPropertyName("statuses")]
    public List<WhatsAppWebhookStatus> Statuses { get; set; } = new();
}

public class WhatsAppWebhookMetadata
{
    [JsonPropertyName("display_phone_number")]
    public string? DisplayPhoneNumber { get; set; }

    [JsonPropertyName("phone_number_id")]
    public string? PhoneNumberId { get; set; }
}

public class WhatsAppWebhookMessage
{
    // Teléfono del paciente (solo dígitos, con código de país). Nunca se
    // registra completo en logs: usar TelefonoWhatsApp.Enmascarar.
    [JsonPropertyName("from")]
    public string? From { get; set; }

    // wamid del mensaje entrante.
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    // Segundos desde epoch, como texto (así lo envía Meta).
    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }

    // "button" (respuesta rápida de una plantilla), "interactive", "text", etc.
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    // Mensaje al que responde: Context.Id es el wamid del recordatorio enviado
    // (Citas.RecordatorioMessageId).
    [JsonPropertyName("context")]
    public WhatsAppWebhookContext? Context { get; set; }

    // Botón de respuesta rápida de una plantilla ("Sí asistiré", "Modificar mi cita").
    [JsonPropertyName("button")]
    public WhatsAppWebhookButton? Button { get; set; }

    // Respuesta a un mensaje interactivo (botones o lista que no son de plantilla).
    [JsonPropertyName("interactive")]
    public WhatsAppWebhookInteractive? Interactive { get; set; }
}

public class WhatsAppWebhookContext
{
    [JsonPropertyName("from")]
    public string? From { get; set; }

    [JsonPropertyName("id")]
    public string? Id { get; set; }
}

public class WhatsAppWebhookButton
{
    [JsonPropertyName("text")]
    public string? Text { get; set; }

    [JsonPropertyName("payload")]
    public string? Payload { get; set; }
}

public class WhatsAppWebhookInteractive
{
    // "button_reply" o "list_reply".
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("button_reply")]
    public WhatsAppWebhookReply? ButtonReply { get; set; }

    [JsonPropertyName("list_reply")]
    public WhatsAppWebhookReply? ListReply { get; set; }
}

public class WhatsAppWebhookReply
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }
}

public class WhatsAppWebhookStatus
{
    // wamid del mensaje que enviamos.
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    // "sent", "delivered", "read" o "failed".
    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }

    [JsonPropertyName("recipient_id")]
    public string? RecipientId { get; set; }

    // Solo cuando status = "failed".
    [JsonPropertyName("errors")]
    public List<WhatsAppWebhookError> Errors { get; set; } = new();
}

public class WhatsAppWebhookError
{
    [JsonPropertyName("code")]
    public int? Code { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }
}
