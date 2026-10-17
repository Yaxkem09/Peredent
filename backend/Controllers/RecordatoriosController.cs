using Microsoft.AspNetCore.Mvc;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Filters;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

// Sin [Authorize] a propósito: este endpoint no lo llama un usuario con JWT
// sino el cron de GitHub Actions (.github/workflows), que no tiene sesión.
// El proyecto no tiene una política de autorización global, así que queda
// fuera de JWT (igual que HealthController); lo protege el header X-Api-Key
// con [RequiereApiKeyRecordatorios].
[ApiController]
[Route("api/recordatorios")]
[RequiereApiKeyRecordatorios]
public class RecordatoriosController : ControllerBase
{
    private readonly IRecordatorioService _recordatorioService;

    public RecordatoriosController(IRecordatorioService recordatorioService)
    {
        _recordatorioService = recordatorioService;
    }

    // Envía el recordatorio por WhatsApp de las citas de mañana. Los fallos de
    // envío individuales van en el resumen (Fallidas), no como error HTTP.
    [HttpPost("enviar")]
    public async Task<ActionResult<RecordatorioResumenDto>> Enviar([FromQuery] bool dryRun = false)
    {
        // CancellationToken.None a propósito (no HttpContext.RequestAborted): si
        // el cliente corta la conexión por timeout a mitad del proceso, conviene
        // terminar de enviar y guardar en vez de dejar citas a medias.
        var resumen = await _recordatorioService.EnviarRecordatoriosDeMananaAsync(dryRun, CancellationToken.None);

        if (resumen.EjecucionEnCurso)
        {
            return Conflict(new { message = "Ya hay un envío de recordatorios en curso. Intenta de nuevo más tarde." });
        }

        return Ok(resumen);
    }
}
