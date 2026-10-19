using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Peredent.Api.DTOs.Request;
using Peredent.Api.Filters;
using Peredent.Api.Helpers;
using Peredent.Api.Options;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

// Sin [Authorize] a propósito: a este endpoint lo llaman los servidores de
// Meta (verificación del webhook y notificaciones de WhatsApp), que no tienen
// un JWT de la app. El proyecto no tiene política de autorización global, así
// que queda fuera de JWT; la autenticación es la de Meta:
//   - GET: el verify token compartido (WHATSAPP_WEBHOOK_VERIFY_TOKEN).
//   - POST: la firma X-Hub-Signature-256 con el App Secret ([ValidarFirmaWhatsApp]).
[ApiController]
[Route("api/whatsapp/webhook")]
public class WhatsAppWebhookController : ControllerBase
{
    private const string ModoSuscripcion = "subscribe";

    // Las notificaciones de Meta pesan unos pocos KB; el límite evita que el
    // buffering del filtro de firma acepte cuerpos arbitrariamente grandes.
    private const long TamanoMaximoCuerpo = 1024 * 1024;

    private readonly string _verifyToken;
    private readonly IWhatsAppWebhookService _webhookService;
    private readonly ILogger<WhatsAppWebhookController> _logger;

    public WhatsAppWebhookController(
        IOptions<WhatsAppOptions> opciones,
        IWhatsAppWebhookService webhookService,
        ILogger<WhatsAppWebhookController> logger)
    {
        _verifyToken = opciones.Value.WebhookVerifyToken;
        _webhookService = webhookService;
        _logger = logger;
    }

    // Verificación inicial que hace Meta al configurar el webhook:
    // GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
    // Responde el challenge en texto plano solo si el token coincide.
    [HttpGet]
    public IActionResult Verificar(
        [FromQuery(Name = "hub.mode")] string? modo,
        [FromQuery(Name = "hub.verify_token")] string? verifyToken,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        if (string.IsNullOrWhiteSpace(_verifyToken))
        {
            _logger.LogError("Verificación del webhook de WhatsApp rechazada: WHATSAPP_WEBHOOK_VERIFY_TOKEN no está configurada.");
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        // Nunca se registra el token recibido ni el configurado.
        if (modo != ModoSuscripcion || !ComparacionSegura.SecretosIguales(verifyToken, _verifyToken))
        {
            _logger.LogWarning("Verificación del webhook de WhatsApp rechazada: modo o verify token incorrectos.");
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        _logger.LogInformation("Webhook de WhatsApp verificado por Meta.");
        return Content(challenge ?? string.Empty, "text/plain");
    }

    // Notificaciones de Meta (respuestas de los pacientes y estados de mensajes).
    // La firma ya se validó en [ValidarFirmaWhatsApp] antes de deserializar.
    [HttpPost]
    [ValidarFirmaWhatsApp]
    [RequestSizeLimit(TamanoMaximoCuerpo)]
    public async Task<IActionResult> Recibir([FromBody] WhatsAppWebhookPayload payload)
    {
        try
        {
            // CancellationToken.None: si Meta corta la conexión, igual se termina de procesar.
            await _webhookService.ProcesarAsync(payload, CancellationToken.None);
        }
        catch (Exception ex)
        {
            // 200 de todas formas: con un error HTTP Meta reintenta la misma
            // notificación durante horas, y el problema es nuestro, no del envío.
            _logger.LogError(ex, "Error al procesar una notificación del webhook de WhatsApp.");
        }

        return Ok();
    }
}
