using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Helpers;
using Peredent.Api.Models;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

// SCRUM-63: abonos que hace el paciente y su saldo pendiente. El saldo no se
// almacena en la base: se recalcula contra el total del plan de tratamiento
// (SCRUM-65), así que siempre refleja el plan tal como está guardado hoy.
// Solo [Authorize]: la historia es de la asistente, pero el odontólogo entra con
// el mismo rol autenticado, igual que en el resto de los controllers clínicos.
// La anulación de un abono es la excepción: es solo para admin (policy SoloAdmin).
[ApiController]
[Authorize]
public class AbonosController : ControllerBase
{
    // Tope de abonos anulados por plan: es un seguro para que el historial de un
    // plan no crezca sin control (ni la pantalla se llene de filas tachadas) y para
    // que la tabla no se sature de basura. Al superarlo se rechaza con 400.
    private const int MaximoAnuladosPorPlan = 50;

    // Largo de MotivoAnulacion en la base (VARCHAR(300)).
    private const int MotivoLongitudMaxima = 300;

    private readonly ApplicationDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<AbonosController> _logger;

    public AbonosController(ApplicationDbContext db, IPasswordHasher passwordHasher, ILogger<AbonosController> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    // SCRUM-64: registra un abono sobre el plan de tratamiento ACTIVO del
    // paciente. El monto lo manda el cliente; la fecha la pone el backend y el
    // usuario sale del token.
    [HttpPost("api/pacientes/{pacienteId:int}/abonos")]
    public async Task<ActionResult<AbonoDto>> Registrar(int pacienteId, [FromBody] RegistrarAbonoDto request)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        if (request.Monto <= 0)
        {
            return BadRequest(new { message = "El monto del abono debe ser mayor a 0." });
        }

        var planActivo = await ObtenerPlanActivoAsync(pacienteId);
        if (planActivo is null)
        {
            return BadRequest(new { message = "Este paciente no tiene un plan de tratamiento activo. Registra el plan antes de registrar abonos." });
        }

        // SCRUM-65: el saldo se recalcula en cada intento, así que un abono que
        // dejaría el plan en descubierto se rechaza antes de guardarlo.
        var total = TotalDelPlan(planActivo);
        var abonado = await SumarAbonosAsync(planActivo.IdPresupuestoPlan);
        var saldo = TotalesPlan.CalcularSaldo(total, abonado);

        if (request.Monto > saldo)
        {
            return BadRequest(new
            {
                message = $"El monto del abono no puede ser mayor al saldo pendiente del plan (Q {saldo.ToString("0.00", CultureInfo.InvariantCulture)}).",
            });
        }

        var idUsuario = ObtenerIdUsuario();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        var abono = new AbonoPaciente
        {
            IdPresupuestoPlan = planActivo.IdPresupuestoPlan,
            IdUsuario = idUsuario.Value,
            MontoAbono = request.Monto,
            // El cliente no manda la fecha: la asigna el backend en hora de
            // Guatemala, igual que el resto de fechas del proyecto (SCRUM-64).
            FechaAbono = FechaGuatemala.Ahora(),
            // Explícito: la columna es NOT NULL con DEFAULT 0, pero el INSERT no
            // depende del default de la base.
            Anulado = false,
        };

        _db.AbonosPaciente.Add(abono);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetEstadoCuenta), new { pacienteId }, new AbonoDto
        {
            IdAbonoPaciente = abono.IdAbonoPaciente,
            Monto = abono.MontoAbono,
            Fecha = abono.FechaAbono,
            // Saldo que queda después de este abono (SCRUM-64 / SCRUM-65).
            SaldoPendiente = TotalesPlan.CalcularSaldo(total, abonado + abono.MontoAbono),
        });
    }

    // SCRUM-66 (primera parte): estado de cuenta del plan activo, con el saldo
    // recalculado y el historial de abonos. Si el paciente no tiene plan activo
    // devuelve 200 con TienePlan=false, igual que el presupuesto (SCRUM-77), para
    // que el frontend muestre el estado vacío en lugar de un error.
    [HttpGet("api/pacientes/{pacienteId:int}/abonos")]
    public async Task<ActionResult<EstadoCuentaPlanDto>> GetEstadoCuenta(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var planActivo = await ObtenerPlanActivoAsync(pacienteId);
        if (planActivo is null)
        {
            return Ok(new EstadoCuentaPlanDto { IdPaciente = pacienteId, TienePlan = false });
        }

        var abonos = await ObtenerAbonosAsync(new[] { planActivo.IdPresupuestoPlan });
        var nombres = await ObtenerNombresUsuariosAsync(abonos);

        return Ok(ArmarEstadoCuentaPlan(pacienteId, planActivo, abonos, nombres));
    }

    // SCRUM-66: estado de cuenta completo del paciente. Devuelve TODOS sus planes
    // (el activo primero y después los cerrados, del más reciente al más antiguo),
    // cada uno con total, descuento, abonado, saldo y su historial de abonos, más
    // un resumen general. Los planes cerrados son solo lectura: no se abona ni se
    // anula sobre ellos.
    [HttpGet("api/pacientes/{pacienteId:int}/estado-cuenta")]
    public async Task<ActionResult<EstadoCuentaPacienteDto>> GetEstadoCuentaPaciente(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var planes = await _db.PresupuestosPlan
            .Include(p => p.Piezas)
            .Where(p => p.IdPaciente == pacienteId)
            .ToListAsync();

        // El activo (FechaCierre NULL) va primero; los cerrados, del cierre más
        // reciente al más antiguo. Se ordena en memoria porque son pocos planes y
        // así el criterio queda explícito.
        var ordenados = planes
            .OrderByDescending(p => p.FechaCierre is null)
            .ThenByDescending(p => p.FechaCierre ?? p.FechaInicioPlan)
            .ThenByDescending(p => p.IdPresupuestoPlan)
            .ToList();

        // Una sola consulta de abonos para todos los planes, y el mismo armador
        // que usa el resto del controller.
        var abonos = await ObtenerAbonosAsync(ordenados.Select(p => p.IdPresupuestoPlan));
        var abonosPorPlan = abonos
            .GroupBy(a => a.IdPresupuestoPlan)
            .ToDictionary(g => g.Key, g => g.ToList());
        var nombres = await ObtenerNombresUsuariosAsync(abonos);

        var estados = ordenados
            .Select(plan => ArmarEstadoCuentaPlan(
                pacienteId,
                plan,
                abonosPorPlan.TryGetValue(plan.IdPresupuestoPlan, out var delPlan) ? delPlan : new List<AbonoPaciente>(),
                nombres))
            .ToList();

        return Ok(new EstadoCuentaPacienteDto
        {
            IdPaciente = pacienteId,
            NombrePaciente = $"{paciente.Nombres} {paciente.Apellidos}".Trim(),
            TienePlanes = estados.Count > 0,
            IdPlanActivo = estados.FirstOrDefault(e => e.Activo)?.IdPresupuestoPlan,
            Resumen = new ResumenEstadoCuentaDto
            {
                TotalPlanes = estados.Count,
                TotalTratamientos = estados.Sum(e => e.Total),
                TotalAbonado = estados.Sum(e => e.Abonado),
                SaldoPendiente = estados.Sum(e => e.Saldo),
            },
            Planes = estados,
        });
    }

    // Anulación de un abono: SOLO admin (policy SoloAdmin, claim esAdmin del token).
    // El abono no se borra: se marca Anulado y queda tachado en el historial, para
    // que un error al registrar no borre el rastro. La acción no se puede deshacer
    // desde la app, así que se confirma con la contraseña del propio admin logueado.
    [HttpPost("api/pacientes/{pacienteId:int}/abonos/{abonoId:int}/anular")]
    [Authorize(Policy = "SoloAdmin")]
    public async Task<ActionResult<EstadoCuentaPlanDto>> Anular(int pacienteId, int abonoId, [FromBody] AnularAbonoDto request)
    {
        var idUsuario = ObtenerIdUsuario();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        if (!await ConfirmarPasswordAsync(idUsuario.Value, request.Password))
        {
            // Genérico a propósito: no se distingue entre contraseña vacía,
            // incorrecta o usuario inexistente, y nunca se registra ni se devuelve.
            return BadRequest(new { message = "No se pudo confirmar la contraseña." });
        }

        var abono = await _db.AbonosPaciente.FirstOrDefaultAsync(a => a.IdAbonoPaciente == abonoId);
        if (abono is null)
        {
            return NotFound(new { message = "Abono no encontrado." });
        }

        var plan = await _db.PresupuestosPlan
            .Include(p => p.Piezas)
            .FirstOrDefaultAsync(p => p.IdPresupuestoPlan == abono.IdPresupuestoPlan);

        // El abono tiene que ser de ESTE paciente; si es de otro, no se revela nada.
        if (plan is null || plan.IdPaciente != pacienteId)
        {
            return NotFound(new { message = "Abono no encontrado." });
        }

        if (plan.FechaCierre is not null)
        {
            return BadRequest(new { message = "Este abono pertenece a un plan ya cerrado y no se puede anular." });
        }

        if (abono.Anulado)
        {
            return BadRequest(new { message = "Este abono ya está anulado." });
        }

        var anuladosDelPlan = await _db.AbonosPaciente
            .CountAsync(a => a.IdPresupuestoPlan == plan.IdPresupuestoPlan && a.Anulado);
        if (anuladosDelPlan >= MaximoAnuladosPorPlan)
        {
            return BadRequest(new { message = $"Este plan ya alcanzó el máximo de {MaximoAnuladosPorPlan} abonos anulados permitidos." });
        }

        var motivo = string.IsNullOrWhiteSpace(request.Motivo) ? null : request.Motivo.Trim();
        if (motivo is not null && motivo.Length > MotivoLongitudMaxima)
        {
            return BadRequest(new { message = $"El motivo no puede tener más de {MotivoLongitudMaxima} caracteres." });
        }

        var fechaAnulacion = FechaGuatemala.Ahora();

        abono.Anulado = true;
        abono.FechaAnulacion = fechaAnulacion;
        abono.IdUsuarioAnulacion = idUsuario.Value;
        abono.MotivoAnulacion = motivo;

        await _db.SaveChangesAsync();

        // DEUDA TÉCNICA: la base no guarda trazabilidad del intento de confirmación
        // (solo el resultado en el propio abono) y no hay límite de intentos de
        // contraseña: pendiente definir con el PO la anulación visible con motivo,
        // usuario y fecha —que ya se guardan aquí—, el registro de intentos y un
        // bloqueo temporal tras varios fallos seguidos.
        // Respaldo extra fuera de la base: quién anuló qué y cuándo. SIN la contraseña.
        _logger.LogWarning(
            "Abono anulado: idUsuario={IdUsuario} idAbono={IdAbono} idPresupuestoPlan={IdPresupuestoPlan} idPaciente={IdPaciente} monto={Monto} fechaAbono={FechaAbono} fechaAnulacion={FechaAnulacion}",
            idUsuario.Value,
            abono.IdAbonoPaciente,
            abono.IdPresupuestoPlan,
            pacienteId,
            abono.MontoAbono,
            abono.FechaAbono,
            fechaAnulacion);

        // Se devuelve el estado de cuenta del plan para que la vista refresque
        // resumen, lista y saldo con lo que calculó el backend.
        var abonos = await ObtenerAbonosAsync(new[] { plan.IdPresupuestoPlan });
        var nombres = await ObtenerNombresUsuariosAsync(abonos);

        return Ok(ArmarEstadoCuentaPlan(pacienteId, plan, abonos, nombres));
    }

    // Reutiliza exactamente la verificación del login (mismo hash y mismo salt del
    // usuario): acá no se reimplementa el hashing. Comparación OrdinalIgnoreCase,
    // igual que en AuthController.
    private async Task<bool> ConfirmarPasswordAsync(int idUsuario, string? password)
    {
        if (string.IsNullOrEmpty(password))
        {
            return false;
        }

        var usuario = await _db.Usuarios.FirstOrDefaultAsync(u => u.IdUsuario == idUsuario);
        if (usuario is null)
        {
            return false;
        }

        // SCRUM-230: la verificación dual (bcrypt o el SHA2_256 legado) la resuelve
        // el propio IPasswordHasher, así que acá no se reimplementa el hashing.
        return _passwordHasher.Verificar(password, usuario.ContrasenaHash, usuario.Salt);
    }

    // Un paciente tiene un solo plan activo (FechaCierre NULL), reforzado en la
    // base con un índice único filtrado (ver PeredentScript_Sprint2.sql).
    private Task<PresupuestoPlan?> ObtenerPlanActivoAsync(int pacienteId)
    {
        return _db.PresupuestosPlan
            .Include(p => p.Piezas)
            .FirstOrDefaultAsync(p => p.IdPaciente == pacienteId && p.FechaCierre == null);
    }

    // El idUsuario viaja en el token (JwtTokenService lo emite como claim
    // propio). No se acepta del cuerpo: así nadie registra abonos a nombre de otro.
    private int? ObtenerIdUsuario()
    {
        var valor = User.FindFirstValue("idUsuario");
        return int.TryParse(valor, out var idUsuario) ? idUsuario : null;
    }

    // El total del plan es el mismo que muestran el plan de tratamiento y el
    // presupuesto: SUM(valor de las piezas) menos el descuento (SCRUM-65).
    private static decimal TotalDelPlan(PresupuestoPlan plan)
    {
        return TotalesPlan.CalcularTotal(plan.Piezas.Sum(pt => pt.Valor), plan.CantidadDescuento ?? 0);
    }

    // ÚNICO punto donde se leen los abonos de un plan (registro, saldo y estado de
    // cuenta). Devuelve también los anulados, porque el historial los muestra
    // tachados; quien suma tiene que usar CuentaParaElSaldo.
    private async Task<List<AbonoPaciente>> ObtenerAbonosAsync(IEnumerable<int> idsPresupuesto)
    {
        var ids = idsPresupuesto.Distinct().ToList();

        return await _db.AbonosPaciente
            .Where(a => ids.Contains(a.IdPresupuestoPlan))
            .OrderBy(a => a.FechaAbono)
            .ThenBy(a => a.IdAbonoPaciente)
            .ToListAsync();
    }

    // ÚNICO criterio de "abono que cuenta": los anulados quedan en el historial
    // pero NO suman al abonado ni al saldo (ni al saldo corriente de cada fila), en
    // ningún plan, activo o cerrado.
    private static bool CuentaParaElSaldo(AbonoPaciente abono) => !abono.Anulado;

    private async Task<decimal> SumarAbonosAsync(int idPresupuestoPlan)
    {
        var abonos = await ObtenerAbonosAsync(new[] { idPresupuestoPlan });
        return abonos.Where(CuentaParaElSaldo).Sum(a => a.MontoAbono);
    }

    // Nombre del admin que anuló cada abono, para mostrarlo en el historial. Se
    // resuelve en una sola consulta para todos los abonos del paciente.
    private async Task<Dictionary<int, string>> ObtenerNombresUsuariosAsync(IEnumerable<AbonoPaciente> abonos)
    {
        var ids = abonos
            .Where(a => a.IdUsuarioAnulacion.HasValue)
            .Select(a => a.IdUsuarioAnulacion!.Value)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        return await _db.Usuarios
            .Where(u => ids.Contains(u.IdUsuario))
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreUsuario);
    }

    // Arma el estado de cuenta de un plan ya cargado: totales, abonado, saldo e historial.
    private static EstadoCuentaPlanDto ArmarEstadoCuentaPlan(
        int pacienteId,
        PresupuestoPlan plan,
        List<AbonoPaciente> abonos,
        IReadOnlyDictionary<int, string> nombresUsuarios)
    {
        var subtotal = plan.Piezas.Sum(pt => pt.Valor);
        var descuento = plan.CantidadDescuento ?? 0;
        var total = TotalesPlan.CalcularTotal(subtotal, descuento);

        // El saldoPendiente de cada fila NO se guarda: es el saldo corriente al
        // momento de ese abono contra el total ACTUAL del plan, acumulando en
        // orden por fecha y luego por ID (si el plan se edita después, todas las
        // filas se recalculan). Al final se invierte para mostrar los abonos del
        // más reciente al más antiguo. Los anulados no suman, así que no dejan
        // saldo propio.
        var acumulado = 0m;
        var historial = new List<AbonoDto>(abonos.Count);
        foreach (var abono in abonos)
        {
            if (CuentaParaElSaldo(abono))
            {
                acumulado += abono.MontoAbono;
            }

            historial.Add(new AbonoDto
            {
                IdAbonoPaciente = abono.IdAbonoPaciente,
                Monto = abono.MontoAbono,
                Fecha = abono.FechaAbono,
                SaldoPendiente = CuentaParaElSaldo(abono) ? TotalesPlan.CalcularSaldo(total, acumulado) : null,
                Anulado = abono.Anulado,
                FechaAnulacion = abono.FechaAnulacion,
                MotivoAnulacion = abono.MotivoAnulacion,
                UsuarioAnulacion = abono.IdUsuarioAnulacion is int idUsuario
                    && nombresUsuarios.TryGetValue(idUsuario, out var nombre)
                        ? nombre
                        : null,
            });
        }

        historial.Reverse();

        return new EstadoCuentaPlanDto
        {
            TienePlan = true,
            IdPresupuestoPlan = plan.IdPresupuestoPlan,
            IdPaciente = pacienteId,
            FechaInicio = plan.FechaInicioPlan,
            FechaCierre = plan.FechaCierre,
            Activo = plan.FechaCierre == null,
            Subtotal = subtotal,
            Descuento = descuento,
            Total = total,
            Abonado = acumulado,
            Saldo = TotalesPlan.CalcularSaldo(total, acumulado),
            Abonos = historial,
        };
    }
}
