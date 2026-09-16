using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

[ApiController]
[Route("api/citas")]
[Authorize]
public class CitasController : ControllerBase
{
    private const string RolOdontologo = "Odontologo";

    private readonly ICitaService _citaService;

    public CitasController(ICitaService citaService)
    {
        _citaService = citaService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CitaDto>>> GetByRango(
        [FromQuery] DateOnly desde,
        [FromQuery] DateOnly hasta,
        [FromQuery] int? idUsuario = null)
    {
        if (desde > hasta)
        {
            return BadRequest(new { message = "La fecha 'desde' no puede ser posterior a 'hasta'." });
        }

        // Un odontólogo tiene su propio calendario: sin importar qué idUsuario venga
        // en el query string, siempre se fuerza al de su propio token. Solo
        // Asistentes (y cuentas sin ese rol clínico) pueden pedir el de otro.
        if (User.IsInRole(RolOdontologo))
        {
            idUsuario = ObtenerIdUsuarioActual();
        }

        var citas = await _citaService.GetByRangoAsync(desde, hasta, idUsuario);
        return Ok(citas);
    }

    private int? ObtenerIdUsuarioActual() =>
        int.TryParse(User.FindFirstValue("idUsuario"), out var id) ? id : null;

    // Citas de hoy en adelante para el dashboard. "proximas" no matchea la
    // restricción {id:int} de abajo, así que no hay ambigüedad de rutas.
    [HttpGet("proximas")]
    public async Task<ActionResult<IEnumerable<CitaDto>>> GetProximas()
    {
        var citas = await _citaService.GetProximasAsync();
        return Ok(citas);
    }

    // Catálogo de estados de cita (para el selector de estado al editar una cita).
    // "estados" no matchea la restricción {id:int} de abajo, así que no hay ambigüedad de rutas.
    [HttpGet("estados")]
    public async Task<ActionResult<IEnumerable<EstadoCitaDto>>> GetEstados()
    {
        var estados = await _citaService.GetEstadosAsync();
        return Ok(estados);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CitaDto>> GetById(int id)
    {
        var cita = await _citaService.GetByIdAsync(id);
        if (cita is null)
        {
            return NotFound(new { message = "La cita indicada no existe." });
        }

        return Ok(cita);
    }

    [HttpPost]
    public async Task<ActionResult<CitaDto>> Create([FromBody] CreateCitaDto request)
    {
        var resultado = await _citaService.CrearAsync(request);
        if (!resultado.Exitoso)
        {
            return MapearError(resultado.Error!.Value, resultado.Mensaje!);
        }

        return CreatedAtAction(nameof(GetById), new { id = resultado.Cita!.IdCita }, resultado.Cita);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CitaDto>> Update(int id, [FromBody] UpdateCitaDto request)
    {
        var resultado = await _citaService.ActualizarAsync(id, request);
        if (!resultado.Exitoso)
        {
            return MapearError(resultado.Error!.Value, resultado.Mensaje!);
        }

        return Ok(resultado.Cita);
    }

    [HttpPatch("{id:int}/cancelar")]
    public async Task<ActionResult<CitaDto>> Cancelar(int id)
    {
        var resultado = await _citaService.CancelarAsync(id);
        if (!resultado.Exitoso)
        {
            return MapearError(resultado.Error!.Value, resultado.Mensaje!);
        }

        return Ok(resultado.Cita);
    }

    private ActionResult MapearError(CitaError error, string mensaje) => error switch
    {
        CitaError.CitaNoEncontrada or CitaError.PacienteNoEncontrado or CitaError.DentistaNoEncontrado
            => NotFound(new { message = mensaje }),
        _ => BadRequest(new { message = mensaje }),
    };
}
