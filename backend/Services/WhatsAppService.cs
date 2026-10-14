using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Peredent.Api.Helpers;
using Peredent.Api.Options;

namespace Peredent.Api.Services;

// Cliente de la WhatsApp Cloud API de Meta. El HttpClient lo inyecta
// AddHttpClient (BaseAddress https://graph.facebook.com/ y timeout en Program.cs).
public class WhatsAppService : IWhatsAppService
{
    private readonly HttpClient _httpClient;
    private readonly WhatsAppOptions _opciones;
    private readonly ILogger<WhatsAppService> _logger;

    public WhatsAppService(HttpClient httpClient, IOptions<WhatsAppOptions> opciones, ILogger<WhatsAppService> logger)
    {
        _httpClient = httpClient;
        _opciones = opciones.Value;
        _logger = logger;
    }

    public Task<WhatsAppEnvioResultado> EnviarRecordatorioCitaAsync(
        string telefono, string nombrePaciente, string fecha, string hora, CancellationToken ct) =>
        EnviarAsync(telefono, CrearCuerpo(telefono, nombrePaciente, fecha, hora), "recordatorio", ct);

    // Texto libre (type "text"): Meta solo lo permite dentro de las 24 h
    // siguientes al último mensaje del paciente (ventana de atención), que es
    // justo el caso de la respuesta a los botones del recordatorio.
    public Task<WhatsAppEnvioResultado> EnviarTextoAsync(string telefono, string texto, CancellationToken ct) =>
        EnviarAsync(telefono, CrearCuerpoTexto(telefono, texto), "mensaje de texto", ct);

    // Camino común a todos los envíos: nunca lanza por errores de Meta, de red
    // o timeouts (vienen en el resultado); solo propaga la cancelación del ct.
    private async Task<WhatsAppEnvioResultado> EnviarAsync(string telefono, object cuerpo, string tipo, CancellationToken ct)
    {
        var telefonoEnmascarado = TelefonoWhatsApp.Enmascarar(telefono);

        if (!_opciones.Enabled)
        {
            _logger.LogInformation("WhatsApp ({Tipo}) a {Telefono} no enviado: WhatsApp deshabilitado (WHATSAPP_ENABLED)", tipo, telefonoEnmascarado);
            return WhatsAppEnvioResultado.Fallo("El envío por WhatsApp está deshabilitado (WHATSAPP_ENABLED=false).");
        }

        // Authorization va en cada request (no en DefaultRequestHeaders) porque
        // el HttpClient tipado lo comparte el pool de IHttpClientFactory.
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_opciones.ApiVersion}/{_opciones.PhoneNumberId}/messages")
        {
            Content = JsonContent.Create(cuerpo),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opciones.AccessToken);

        try
        {
            using var response = await _httpClient.SendAsync(request, ct);
            var contenido = await response.Content.ReadAsStringAsync(ct);

            if (response.IsSuccessStatusCode)
            {
                var messageId = ExtraerMessageId(contenido);
                _logger.LogInformation("WhatsApp ({Tipo}) enviado a {Telefono}: {MessageId}", tipo, telefonoEnmascarado, WamidWhatsApp.Enmascarar(messageId));
                return WhatsAppEnvioResultado.Ok(messageId);
            }

            var (codigo, mensaje) = ExtraerErrorMeta(contenido);
            _logger.LogWarning(
                "Meta rechazó el {Tipo} a {Telefono}: HTTP {StatusCode}, código {CodigoError}",
                tipo, telefonoEnmascarado, (int)response.StatusCode, codigo);

            var detalle = codigo is null ? mensaje : $"{mensaje} (código {codigo})";
            return WhatsAppEnvioResultado.Fallo($"Meta respondió HTTP {(int)response.StatusCode}: {detalle}");
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            _logger.LogWarning("Timeout al enviar {Tipo} a {Telefono}", tipo, telefonoEnmascarado);
            return WhatsAppEnvioResultado.Fallo($"Timeout: WhatsApp no respondió en {_httpClient.Timeout.TotalSeconds:0} segundos.");
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning("Error de red al enviar {Tipo} a {Telefono}: {Error}", tipo, telefonoEnmascarado, ex.Message);
            return WhatsAppEnvioResultado.Fallo($"Error de red al contactar WhatsApp: {ex.Message}");
        }
    }

    private static object CrearCuerpoTexto(string telefono, string texto) => new
    {
        messaging_product = "whatsapp",
        recipient_type = "individual",
        to = telefono,
        type = "text",
        text = new { preview_url = false, body = texto },
    };

    private object CrearCuerpo(string telefono, string nombrePaciente, string fecha, string hora) => new
    {
        messaging_product = "whatsapp",
        to = telefono,
        type = "template",
        template = new
        {
            name = _opciones.TemplateName,
            language = new { code = _opciones.TemplateLanguage },
            components = new[]
            {
                new
                {
                    type = "body",
                    parameters = new[]
                    {
                        new { type = "text", text = nombrePaciente },
                        new { type = "text", text = fecha },
                        new { type = "text", text = hora },
                    },
                },
            },
        },
    };

    // Respuesta exitosa: { "messages": [ { "id": "wamid...." } ], ... }
    private static string? ExtraerMessageId(string contenido)
    {
        try
        {
            using var json = JsonDocument.Parse(contenido);
            return json.RootElement.TryGetProperty("messages", out var messages)
                && messages.ValueKind == JsonValueKind.Array
                && messages.GetArrayLength() > 0
                && messages[0].TryGetProperty("id", out var id)
                    ? id.GetString()
                    : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // Error de Meta: { "error": { "message": "...", "code": 190, ... } }
    private static (int? Codigo, string Mensaje) ExtraerErrorMeta(string contenido)
    {
        try
        {
            using var json = JsonDocument.Parse(contenido);
            if (json.RootElement.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.Object)
            {
                int? codigo = error.TryGetProperty("code", out var code) && code.TryGetInt32(out var valor) ? valor : null;
                var mensaje = error.TryGetProperty("message", out var message) ? message.GetString() : null;
                return (codigo, mensaje ?? "Error sin mensaje");
            }
        }
        catch (JsonException)
        {
            // Cuerpo no-JSON (p. ej. una página de error de un proxy): se cae al mensaje genérico.
        }

        return (null, "Respuesta sin detalle de error");
    }
}
