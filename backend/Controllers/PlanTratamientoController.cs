using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

[ApiController]
[Authorize]
public class PlanTratamientoController : ControllerBase
{
    private const string EstadoPendiente = "Pendiente";

    // Guatemala es UTC-6 todo el año (no observa horario de verano), así que un
    // offset fijo evita depender de que el servidor tenga cargada la zona horaria.
    private static DateTime FechaHoyGuatemala() => DateTime.UtcNow.AddHours(-6).Date;

    private readonly ApplicationDbContext _db;
    private readonly IPlanTratamientoService _planTratamientoService;

    public PlanTratamientoController(ApplicationDbContext db, IPlanTratamientoService planTratamientoService)
    {
        _db = db;
        _planTratamientoService = planTratamientoService;
    }

    [HttpGet("api/pacientes/{pacienteId:int}/plan-tratamiento")]
    public async Task<ActionResult<PlanTratamientoDto>> GetByPaciente(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var planActivo = await ObtenerPlanActivoAsync(pacienteId, incluirPiezas: true);

        return Ok(ToDto(pacienteId, planActivo));
    }

    [HttpGet("api/pacientes/{pacienteId:int}/plan-tratamiento/historial")]
    public async Task<ActionResult<IEnumerable<PlanTratamientoDto>>> GetHistorial(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var cerrados = await _db.PresupuestosPlan
            .Include(p => p.Piezas).ThenInclude(pt => pt.EstadoTratamiento)
            .Where(p => p.IdPaciente == pacienteId && p.FechaCierre != null)
            .OrderByDescending(p => p.FechaCierre)
            .ToListAsync();

        return Ok(cerrados.Select(p => ToDto(pacienteId, p)));
    }

    [HttpPut("api/pacientes/{pacienteId:int}/plan-tratamiento")]
    public async Task<ActionResult<PlanTratamientoDto>> Guardar(int pacienteId, [FromBody] GuardarPlanTratamientoDto request)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        foreach (var pieza in request.Piezas)
        {
            if (string.IsNullOrWhiteSpace(pieza.Tratamiento))
            {
                continue;
            }

            if (pieza.Valor <= 0)
            {
                return BadRequest(new { message = $"La pieza {pieza.Pieza} tiene un tratamiento pero no tiene un valor mayor a 0." });
            }
        }

        var idEstadoPendiente = await ObtenerIdEstadoAsync(EstadoPendiente);
        if (idEstadoPendiente is null)
        {
            return Problem("El catálogo de estados de tratamiento no está sembrado en la base de datos.");
        }

        var presupuesto = await ObtenerPlanActivoAsync(pacienteId, incluirPiezas: true);

        if (presupuesto is null)
        {
            presupuesto = new PresupuestoPlan { IdPaciente = pacienteId, FechaInicioPlan = FechaHoyGuatemala() };
            _db.PresupuestosPlan.Add(presupuesto);
        }

        presupuesto.CantidadDescuento = request.Descuento;

        // Solo se conservan los renglones donde el odontólogo realmente escribió un tratamiento;
        // una pieza que llega vacía significa que el usuario la limpió en el frontend.
        var recibidas = request.Piezas
            .Where(p => !string.IsNullOrWhiteSpace(p.Tratamiento))
            .GroupBy(p => p.Pieza)
            .ToDictionary(g => g.Key, g => g.Last());

        var aQuitar = presupuesto.Piezas
            .Where(pt => !recibidas.ContainsKey(pt.Pieza))
            .ToList();
        foreach (var huerfana in aQuitar)
        {
            presupuesto.Piezas.Remove(huerfana);
            _db.PlanesTratamiento.Remove(huerfana);
        }

        foreach (var (pieza, datos) in recibidas)
        {
            var existente = presupuesto.Piezas.FirstOrDefault(pt => pt.Pieza == pieza);
            if (existente is not null)
            {
                existente.Tratamiento = datos.Tratamiento!.Trim();
                existente.Valor = datos.Valor;
            }
            else
            {
                presupuesto.Piezas.Add(new PlanTratamiento
                {
                    Pieza = pieza,
                    Tratamiento = datos.Tratamiento!.Trim(),
                    Valor = datos.Valor,
                    IdEstadoTratamiento = idEstadoPendiente.Value,
                    FechaRegistroPlan = FechaHoyGuatemala(),
                });
            }
        }

        await _db.SaveChangesAsync();

        return Ok(ToDto(pacienteId, presupuesto));
    }

    [HttpGet("api/pacientes/{pacienteId:int}/plan-tratamiento/pendientes")]
    public async Task<ActionResult<IEnumerable<TratamientoPendienteDto>>> GetPendientes(int pacienteId)
    {
        var resultado = await _planTratamientoService.ObtenerPendientesPorPacienteAsync(pacienteId);
        if (!resultado.Exitoso)
        {
            return MapearError(resultado.Error!.Value, resultado.Mensaje!);
        }

        return Ok(resultado.Pendientes);
    }

    [HttpPut("api/pacientes/{pacienteId:int}/plan-tratamiento/pendientes/{pieza}/completar")]
    public async Task<ActionResult<IEnumerable<TratamientoPendienteDto>>> MarcarCompletado(int pacienteId, string pieza)
    {
        var resultado = await _planTratamientoService.MarcarComoCompletadoAsync(pacienteId, pieza);
        if (!resultado.Exitoso)
        {
            return MapearError(resultado.Error!.Value, resultado.Mensaje!);
        }

        return Ok(resultado.Pendientes);
    }

    [HttpPost("api/pacientes/{pacienteId:int}/plan-tratamiento/finalizar")]
    public async Task<ActionResult<PlanTratamientoDto>> Finalizar(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var planActivo = await ObtenerPlanActivoAsync(pacienteId, incluirPiezas: false);
        if (planActivo is null)
        {
            return NotFound(new { message = "Este paciente no tiene un plan de tratamiento activo para finalizar." });
        }

        planActivo.FechaCierre = FechaHoyGuatemala();
        await _db.SaveChangesAsync();

        // Sin plan activo todavía: el próximo guardado arranca uno nuevo en blanco.
        return Ok(ToDto(pacienteId, null));
    }

    private Task<PresupuestoPlan?> ObtenerPlanActivoAsync(int pacienteId, bool incluirPiezas)
    {
        var query = _db.PresupuestosPlan.AsQueryable();
        if (incluirPiezas)
        {
            query = query.Include(p => p.Piezas).ThenInclude(pt => pt.EstadoTratamiento);
        }

        return query.FirstOrDefaultAsync(p => p.IdPaciente == pacienteId && p.FechaCierre == null);
    }

    private async Task<int?> ObtenerIdEstadoAsync(string nombre)
    {
        var estado = await _db.EstadosTratamiento.FirstOrDefaultAsync(e => e.Nombre == nombre);
        return estado?.IdEstadoTratamiento;
    }

    private ActionResult MapearError(PlanTratamientoError error, string mensaje) => error switch
    {
        PlanTratamientoError.CatalogoEstadosNoSembrado => Problem(mensaje),
        _ => NotFound(new { message = mensaje }),
    };

    private static PlanTratamientoDto ToDto(int pacienteId, PresupuestoPlan? presupuesto)
    {
        var piezas = presupuesto?.Piezas
            .OrderBy(pt => pt.Pieza)
            .Select(pt => new PiezaPlanRespuestaDto
            {
                Pieza = pt.Pieza,
                Tratamiento = pt.Tratamiento,
                Valor = pt.Valor,
                Estado = pt.EstadoTratamiento?.Nombre ?? string.Empty,
            })
            .ToList() ?? new List<PiezaPlanRespuestaDto>();

        var subtotal = piezas.Sum(p => p.Valor);
        var descuento = presupuesto?.CantidadDescuento ?? 0;

        return new PlanTratamientoDto
        {
            IdPresupuestoPlan = presupuesto?.IdPresupuestoPlan ?? 0,
            IdPaciente = pacienteId,
            FechaInicio = presupuesto?.FechaInicioPlan,
            FechaCierre = presupuesto?.FechaCierre,
            Descuento = descuento,
            Subtotal = subtotal,
            Total = Math.Max(subtotal - descuento, 0),
            Piezas = piezas,
        };
    }
}
