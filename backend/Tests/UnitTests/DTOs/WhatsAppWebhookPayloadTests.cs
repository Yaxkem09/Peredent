using System.Text.Json;
using Peredent.Api.DTOs.Request;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.DTOs;

public class WhatsAppWebhookPayloadTests
{
    // Mismas opciones que usa MVC para [FromBody].
    private static readonly JsonSerializerOptions OpcionesMvc = new(JsonSerializerDefaults.Web);

    private static WhatsAppWebhookValue PrimerValue(string json)
    {
        var payload = JsonSerializer.Deserialize<WhatsAppWebhookPayload>(json, OpcionesMvc)!;
        Assert.Equal("whatsapp_business_account", payload.Object);
        var change = Assert.Single(Assert.Single(payload.Entry).Changes);
        Assert.Equal("messages", change.Field);
        return change.Value!;
    }

    [Fact]
    public void BotonDeRespuestaRapida_SeDeserializaCompleto()
    {
        var value = PrimerValue(WhatsAppWebhookEjemplos.BotonRespuestaRapida);

        Assert.Equal("whatsapp", value.MessagingProduct);
        Assert.Equal("200000000000002", value.Metadata!.PhoneNumberId);
        Assert.Empty(value.Statuses);

        var mensaje = Assert.Single(value.Messages);
        Assert.Equal(WhatsAppWebhookEjemplos.TelefonoPaciente, mensaje.From);
        Assert.Equal(WhatsAppWebhookEjemplos.WamidRespuesta, mensaje.Id);
        Assert.Equal("1760290000", mensaje.Timestamp);
        Assert.Equal("button", mensaje.Type);
        Assert.Equal(WhatsAppWebhookEjemplos.WamidRecordatorio, mensaje.Context!.Id);
        Assert.Equal("Sí asistiré", mensaje.Button!.Text);
        Assert.Equal("Sí asistiré", mensaje.Button.Payload);
        Assert.Null(mensaje.Interactive);
    }

    [Fact]
    public void Estados_SeDeserializanIgnorandoCamposDesconocidos()
    {
        var value = PrimerValue(WhatsAppWebhookEjemplos.Estados);

        Assert.Empty(value.Messages);
        Assert.Collection(value.Statuses,
            entregado =>
            {
                Assert.Equal(WhatsAppWebhookEjemplos.WamidRecordatorio, entregado.Id);
                Assert.Equal("delivered", entregado.Status);
                Assert.Equal("1760290100", entregado.Timestamp);
                Assert.Equal(WhatsAppWebhookEjemplos.TelefonoPaciente, entregado.RecipientId);
                Assert.Empty(entregado.Errors);
            },
            fallido =>
            {
                Assert.Equal("failed", fallido.Status);
                var error = Assert.Single(fallido.Errors);
                Assert.Equal(131026, error.Code);
                Assert.Equal("Message undeliverable", error.Title);
            });
    }

    [Fact]
    public void RespuestaInteractiva_SeDeserializa()
    {
        const string json = """
            { "object": "whatsapp_business_account", "entry": [ { "id": "1", "changes": [ { "field": "messages",
              "value": { "messages": [ { "from": "50251234567", "id": "wamid.X", "timestamp": "1", "type": "interactive",
                "interactive": { "type": "button_reply", "button_reply": { "id": "confirmar", "title": "Sí asistiré" } } } ] } } ] } ] }
            """;

        var mensaje = Assert.Single(PrimerValue(json).Messages);

        Assert.Equal("interactive", mensaje.Type);
        Assert.Equal("button_reply", mensaje.Interactive!.Type);
        Assert.Equal("confirmar", mensaje.Interactive.ButtonReply!.Id);
        Assert.Equal("Sí asistiré", mensaje.Interactive.ButtonReply.Title);
    }
}
