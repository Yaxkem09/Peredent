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
    private const string EstadoCompletado = "Completado";

    // SCRUM-80: leyenda de conformidad del presupuesto. Fuente única del texto,
    // se envía en el DTO para que la vista y el PDF muestren lo mismo.
    private const string LeyendaConformidad =
        "Este presupuesto está sujeto a cambios imprevistos que puedan surgir durante el tratamiento.";

    // Guatemala es UTC-6 todo el año (no observa horario de verano), así que un
    // offset fijo evita depender de que el servidor tenga cargada la zona horaria.
    // Se marca como Unspecified (no Utc): es una fecha de calendario, no un
    // instante. Si conservara Kind=Utc, al serializarse a JSON saldría con
    // sufijo "Z" y el frontend la mostraría un día antes al convertirla a hora
    // local. Así queda igual que las fechas que devuelve EF desde la BD.
    private static DateTime FechaHoyGuatemala() =>
        DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-6).Date, DateTimeKind.Unspecified);

    private readonly ApplicationDbContext _db;
    private readonly IPlanTratamientoService _planTratamientoService;
    private readonly IPresupuestoPdfService _presupuestoPdfService;

    public PlanTratamientoController(
        ApplicationDbContext db,
        IPlanTratamientoService planTratamientoService,
        IPresupuestoPdfService presupuestoPdfService)
    {
        _db = db;
        _planTratamientoService = planTratamientoService;
        _presupuestoPdfService = presupuestoPdfService;
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

    // SCRUM-51: historial cronológico de tratamientos ya realizados del paciente
    // (pieza, tratamiento, fecha). Reúne las piezas marcadas como "Completado" de
    // todos sus planes —el activo y los cerrados— y las devuelve de la más reciente
    // a la más antigua. El filtrado por pieza y por rango de fechas lo aplica el
    // frontend sobre esta lista.
    [HttpGet("api/pacientes/{pacienteId:int}/plan-tratamiento/historial-tratamientos")]
    public async Task<ActionResult<IEnumerable<HistorialTratamientoDto>>> GetHistorialTratamientos(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var completados = await _db.PlanesTratamiento
            .Include(pt => pt.EstadoTratamiento)
            .Where(pt => pt.EstadoTratamiento.Nombre == EstadoCompletado
                && _db.PresupuestosPlan.Any(p => p.IdPresupuestoPlan == pt.IdPresupuestoPlan && p.IdPaciente == pacienteId))
            .ToListAsync();

        var historial = completados
            .OrderByDescending(pt => pt.FechaFinTratamiento ?? pt.FechaRegistroPlan)
            .ThenByDescending(pt => pt.IdPlanTratamiento)
            .Select(pt => new HistorialTratamientoDto
            {
                Pieza = pt.Pieza,
                Tratamiento = pt.Tratamiento,
                Fecha = pt.FechaFinTratamiento ?? pt.FechaRegistroPlan,
            })
            .ToList();

        return Ok(historial);
    }

    // SCRUM-77 / SCRUM-79 / SCRUM-205: presupuesto para firma del paciente. No se
    // guarda como copia; se arma aquí a partir del plan de tratamiento reciente
    // (el activo, o el último cerrado si ya no hay activo), así que cualquier
    // cambio guardado en el plan queda reflejado en la siguiente consulta.
    [HttpGet("api/pacientes/{pacienteId:int}/plan-tratamiento/presupuesto")]
    public async Task<ActionResult<PresupuestoDto>> GetPresupuesto(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        return Ok(await ArmarPresupuestoAsync(paciente));
    }

    // SCRUM-78: el mismo presupuesto exportado como PDF descargable.
    [HttpGet("api/pacientes/{pacienteId:int}/plan-tratamiento/presupuesto/pdf")]
    public async Task<IActionResult> GetPresupuestoPdf(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var presupuesto = await ArmarPresupuestoAsync(paciente);
        if (!presupuesto.TienePlan)
        {
            return BadRequest(new { message = "Este paciente no tiene un plan de tratamiento para exportar." });
        }

        var pdf = _presupuestoPdfService.Generar(presupuesto);
        var nombreArchivo =
            $"presupuesto-{ParteNombreArchivo($"{paciente.Nombres} {paciente.Apellidos}")}-{presupuesto.FechaEmision:yyyy-MM-dd}.pdf";

        return File(pdf, "application/pdf", nombreArchivo);
    }

    private async Task<PresupuestoDto> ArmarPresupuestoAsync(Paciente paciente)
    {
        // El presupuesto es para firmar antes de iniciar el tratamiento: si no hay
        // plan activo no se muestra el último plan finalizado, se muestra el
        // estado vacío ("sin plan activo") en su lugar.
        var plan = await ObtenerPlanActivoAsync(paciente.IdPaciente, incluirPiezas: true);

        return ToPresupuestoDto(paciente, plan);
    }

    private static string ParteNombreArchivo(string texto)
    {
        var limpio = new string(texto.Where(c => char.IsLetterOrDigit(c) || c == ' ').ToArray());
        return limpio.Trim().Replace(' ', '-').ToLowerInvariant();
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

        var planActivo = await ObtenerPlanActivoAsync(pacienteId, incluirPiezas: true);
        if (planActivo is null)
        {
            return NotFound(new { message = "Este paciente no tiene un plan de tratamiento activo para finalizar." });
        }

        // Un plan solo se puede finalizar cuando todas sus piezas están en estado
        // "Completado": mientras quede alguna pendiente, el tratamiento no ha terminado.
        var piezasPendientes = planActivo.Piezas
            .Where(pt => pt.EstadoTratamiento?.Nombre != EstadoCompletado)
            .Select(pt => pt.Pieza)
            .OrderBy(pieza => pieza)
            .ToList();

        if (piezasPendientes.Count > 0)
        {
            return BadRequest(new
            {
                message = piezasPendientes.Count == 1
                    ? $"No se puede finalizar el plan: la pieza {piezasPendientes[0]} todavía no está completada."
                    : $"No se puede finalizar el plan: las piezas {string.Join(", ", piezasPendientes)} todavía no están completadas.",
            });
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

    // Las piezas se guardan como su etiqueta (p. ej. "4a", "21l"), no como el
    // número de PIEZAS_DENTALES; ordenar por esa cadena las deja alfabéticas
    // ("1", "10g", "11h", ... "2", "20", ...) en vez de 1 a 32. Se ordena por el
    // prefijo numérico de la etiqueta, que es justo ese número de pieza.
    private static int NumeroPieza(string pieza)
    {
        var digitos = new string(pieza.TakeWhile(char.IsDigit).ToArray());
        return int.TryParse(digitos, out var numero) ? numero : int.MaxValue;
    }

    private static PresupuestoDto ToPresupuestoDto(Paciente paciente, PresupuestoPlan? plan)
    {
        // Solo renglones con tratamiento escrito; el detalle del presupuesto son
        // pieza, tratamiento y valor (SCRUM-79), sin el estado del tratamiento.
        var detalle = plan?.Piezas
            .Where(pt => !string.IsNullOrWhiteSpace(pt.Tratamiento))
            .OrderBy(pt => NumeroPieza(pt.Pieza))
            .Select(pt => new PresupuestoLineaDto
            {
                Pieza = pt.Pieza,
                Tratamiento = pt.Tratamiento,
                Valor = pt.Valor,
            })
            .ToList() ?? new List<PresupuestoLineaDto>();

        var subtotal = detalle.Sum(l => l.Valor);
        var descuento = plan?.CantidadDescuento ?? 0;

        return new PresupuestoDto
        {
            IdPaciente = paciente.IdPaciente,
            NombrePaciente = $"{paciente.Nombres} {paciente.Apellidos}".Trim(),
            FechaEmision = FechaHoyGuatemala(),
            FechaPlan = plan?.FechaInicioPlan,
            TienePlan = detalle.Count > 0,
            Detalle = detalle,
            Subtotal = subtotal,
            Descuento = descuento,
            Total = Math.Max(subtotal - descuento, 0),
            LeyendaConformidad = LeyendaConformidad,
        };
    }

    private static PlanTratamientoDto ToDto(int pacienteId, PresupuestoPlan? presupuesto)
    {
        var piezas = presupuesto?.Piezas
            .OrderBy(pt => NumeroPieza(pt.Pieza))
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
