namespace Peredent.Api.Tests.UnitTests;

// Payloads de ejemplo con la forma real que envía Meta al webhook (campos que
// no modelamos, como conversation y pricing, incluidos a propósito para
// verificar que se ignoran). Teléfonos y wamid ficticios.
internal static class WhatsAppWebhookEjemplos
{
    public const string TelefonoPaciente = "50251234567";
    public const string WamidRecordatorio = "wamid.RECORDATORIO0000000001";
    public const string WamidRespuesta = "wamid.RESPUESTA00000000001";

    // El paciente tocó "Sí asistiré" en la plantilla recordatorio_cita.
    public const string BotonRespuestaRapida = """
        {
          "object": "whatsapp_business_account",
          "entry": [
            {
              "id": "100000000000001",
              "changes": [
                {
                  "value": {
                    "messaging_product": "whatsapp",
                    "metadata": { "display_phone_number": "15550000000", "phone_number_id": "200000000000002" },
                    "contacts": [ { "profile": { "name": "Juan" }, "wa_id": "50251234567" } ],
                    "messages": [
                      {
                        "context": { "from": "15550000000", "id": "wamid.RECORDATORIO0000000001" },
                        "from": "50251234567",
                        "id": "wamid.RESPUESTA00000000001",
                        "timestamp": "1760290000",
                        "type": "button",
                        "button": { "payload": "Sí asistiré", "text": "Sí asistiré" }
                      }
                    ]
                  },
                  "field": "messages"
                }
              ]
            }
          ]
        }
        """;

    // Estados de mensajes que enviamos: uno entregado y uno fallido.
    public const string Estados = """
        {
          "object": "whatsapp_business_account",
          "entry": [
            {
              "id": "100000000000001",
              "changes": [
                {
                  "value": {
                    "messaging_product": "whatsapp",
                    "metadata": { "display_phone_number": "15550000000", "phone_number_id": "200000000000002" },
                    "statuses": [
                      {
                        "id": "wamid.RECORDATORIO0000000001",
                        "status": "delivered",
                        "timestamp": "1760290100",
                        "recipient_id": "50251234567",
                        "conversation": { "id": "CONV1", "origin": { "type": "utility" } },
                        "pricing": { "billable": true, "pricing_model": "CBP", "category": "utility" }
                      },
                      {
                        "id": "wamid.RECORDATORIO0000000002",
                        "status": "failed",
                        "timestamp": "1760290200",
                        "recipient_id": "50251234568",
                        "errors": [ { "code": 131026, "title": "Message undeliverable", "message": "Message undeliverable" } ]
                      }
                    ]
                  },
                  "field": "messages"
                }
              ]
            }
          ]
        }
        """;
}
