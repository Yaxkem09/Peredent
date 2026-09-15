using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

[ApiController]
[Route("api/bloqueos-agenda")]
[Authorize]
public class BloqueosAgendaController : ControllerBase
{
    private const string RolOdontologo = "Odontologo";

    private readonly IBloqueoAgendaService _service;

    public BloqueosAgendaController(IBloqueoAgendaService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BloqueoAgendaDto>>> GetByRango(
        [FromQuery] DateOnly desde,
        [FromQuery] DateOnly hasta,
        [FromQuery] int? idUsuario)
    {
        if (desde > hasta)
        {
            return BadRequest(new { message = "La fecha 'desde' no puede ser posterior a 'hasta'." });
        }

        // Mismo criterio que /api/citas: un odontólogo solo ve sus propios bloqueos.
        if (User.IsInRole(RolOdontologo))
        {
            idUsuario = ObtenerIdUsuarioActual();
        }

        var bloqueos = await _service.GetByRangoAsync(desde, hasta, idUsuario);
        return Ok(bloqueos);
    }

    // Solo el odontólogo dueño de la agenda puede marcar sus propios días
    // libres -- una Asistente no elige por él.
    [HttpPost]
    [Authorize(Roles = RolOdontologo)]
    public async Task<ActionResult<BloqueoAgendaDto>> Create([FromBody] CreateBloqueoAgendaDto request)
    {
        var idUsuario = ObtenerIdUsuarioActual();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        var resultado = await _service.CrearAsync(idUsuario.Value, request);
        if (!resultado.Exitoso)
        {
            return BadRequest(new { message = resultado.Mensaje });
        }

        return Ok(resultado.Bloqueo);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = RolOdontologo)]
    public async Task<IActionResult> Delete(int id)
    {
        var idUsuario = ObtenerIdUsuarioActual();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        var eliminado = await _service.EliminarAsync(id, idUsuario.Value);
        return eliminado ? NoContent() : NotFound();
    }

    private int? ObtenerIdUsuarioActual() =>
        int.TryParse(User.FindFirstValue("idUsuario"), out var id) ? id : null;
}
