using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Helpers;
using Peredent.Api.Models;

namespace Peredent.Api.Controllers;

// SCRUM-265: resumen de ingresos de la clínica para el dashboard. Solo el rol
// Odontologo (SCRUM-273); el frontend además oculta la sección a la asistente.
[ApiController]
[Authorize(Roles = "Odontologo")]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public DashboardController(ApplicationDbContext db)
    {
        _db = db;
    }

    // Cuántos pacientes muestra el ranking de saldos pendientes.
    private const int TopPacientesSaldo = 10;

    // SCRUM-270 / SCRUM-271 / SCRUM-272: total de pagos del día y de la semana
    // (lunes a domingo), desglosados por método de pago, más el detalle de cada
    // día. Sin parámetro es la semana actual; con "semana" (cualquier fecha) es
    // la semana que contiene esa fecha, para revisar semanas anteriores. Una
    // fecha futura se toma como la semana actual. Los abonos anulados no
    // cuentan. No se guarda nada: se calcula en cada consulta, así que un abono
    // recién registrado ya aparece en la siguiente (SCRUM-274).
    [HttpGet("api/dashboard/resumen-pagos")]
    public async Task<ActionResult<ResumenPagosDto>> GetResumenPagos([FromQuery] DateTime? semana = null)
    {
        var hoy = FechaGuatemala.Hoy();
        var inicioSemanaActual = LunesDe(hoy);
        var inicioSemana = semana is DateTime fecha ? LunesDe(fecha.Date) : inicioSemanaActual;
        if (inicioSemana > inicioSemanaActual)
        {
            inicioSemana = inicioSemanaActual;
        }
        var finSemana = inicioSemana.AddDays(6);

        // La semana consultada y, si es una semana anterior, también hoy (para
        // que "Hoy" siga siendo el día actual).
        var abonos = await _db.AbonosPaciente
            .Where(a => !a.Anulado &&
                ((a.FechaAbono >= inicioSemana && a.FechaAbono < finSemana.AddDays(1)) ||
                 (a.FechaAbono >= hoy && a.FechaAbono < hoy.AddDays(1))))
            .Select(a => new { a.FechaAbono, a.MontoAbono, a.IdMetodoPago })
            .ToListAsync();
        var abonosSemana = abonos.Where(a => a.FechaAbono.Date >= inicioSemana && a.FechaAbono.Date <= finSemana).ToList();

        var metodos = await _db.MetodosPago
            .OrderBy(m => m.IdMetodoPago)
            .ToListAsync();

        PeriodoPagosDto ArmarDia(DateTime dia) => ArmarPeriodo(
            dia,
            dia,
            abonos.Where(a => a.FechaAbono.Date == dia).Select(a => (a.MontoAbono, a.IdMetodoPago)),
            metodos);

        return Ok(new ResumenPagosDto
        {
            Hoy = ArmarDia(hoy),
            EsSemanaActual = inicioSemana == inicioSemanaActual,
            Semana = ArmarPeriodo(inicioSemana, finSemana, abonosSemana.Select(a => (a.MontoAbono, a.IdMetodoPago)), metodos),
            Dias = Enumerable.Range(0, 7).Select(i => ArmarDia(inicioSemana.AddDays(i))).ToList(),
        });
    }

    // Pacientes con saldo pendiente, de mayor a menor, sumando todos sus planes
    // (el activo y los cerrados que quedaron debiendo). Mismo cálculo que el
    // estado de cuenta: total del plan (piezas menos descuento) menos abonos no
    // anulados. Por defecto devuelve el top 10; con todos=true, la lista
    // completa. El total de pacientes y el monto por cobrar son siempre de todos.
    [HttpGet("api/dashboard/saldos-pendientes")]
    public async Task<ActionResult<SaldosPendientesDto>> GetSaldosPendientes([FromQuery] bool todos = false)
    {
        var planes = await _db.PresupuestosPlan
            .Select(p => new
            {
                p.IdPresupuestoPlan,
                p.IdPaciente,
                Subtotal = p.Piezas.Sum(pt => pt.Valor),
                Descuento = p.CantidadDescuento ?? 0,
            })
            .ToListAsync();

        var abonadoPorPlan = await _db.AbonosPaciente
            .Where(a => !a.Anulado)
            .GroupBy(a => a.IdPresupuestoPlan)
            .Select(g => new { IdPresupuestoPlan = g.Key, Abonado = g.Sum(a => a.MontoAbono) })
            .ToDictionaryAsync(x => x.IdPresupuestoPlan, x => x.Abonado);

        var deudores = planes
            .Select(p => new
            {
                p.IdPaciente,
                Saldo = TotalesPlan.CalcularSaldo(
                    TotalesPlan.CalcularTotal(p.Subtotal, p.Descuento),
                    abonadoPorPlan.GetValueOrDefault(p.IdPresupuestoPlan)),
            })
            .Where(p => p.Saldo > 0)
            .GroupBy(p => p.IdPaciente)
            .Select(g => new { IdPaciente = g.Key, Saldo = g.Sum(p => p.Saldo), Planes = g.Count() })
            .OrderByDescending(x => x.Saldo)
            .ThenBy(x => x.IdPaciente)
            .ToList();

        var top = todos ? deudores : deudores.Take(TopPacientesSaldo).ToList();

        var ids = top.Select(t => t.IdPaciente).ToList();
        var pacientes = await _db.Pacientes
            .Where(p => ids.Contains(p.IdPaciente))
            .ToDictionaryAsync(p => p.IdPaciente);

        return Ok(new SaldosPendientesDto
        {
            TotalPacientes = deudores.Count,
            TotalPorCobrar = deudores.Sum(d => d.Saldo),
            Pacientes = top
                .Where(t => pacientes.ContainsKey(t.IdPaciente))
                .Select(t => new PacienteSaldoDto
                {
                    IdPaciente = t.IdPaciente,
                    NombrePaciente = $"{pacientes[t.IdPaciente].Nombres} {pacientes[t.IdPaciente].Apellidos}".Trim(),
                    Telefono = pacientes[t.IdPaciente].Telefono,
                    SaldoPendiente = t.Saldo,
                    PlanesConSaldo = t.Planes,
                })
                .ToList(),
        });
    }

    // DayOfWeek: domingo = 0. La semana empieza el lunes.
    private static DateTime LunesDe(DateTime fecha) =>
        DateTime.SpecifyKind(fecha.AddDays(-(((int)fecha.DayOfWeek + 6) % 7)), DateTimeKind.Unspecified);

    private static PeriodoPagosDto ArmarPeriodo(
        DateTime desde,
        DateTime hasta,
        IEnumerable<(decimal Monto, int IdMetodoPago)> abonos,
        List<MetodoPago> metodos)
    {
        var lista = abonos.ToList();

        return new PeriodoPagosDto
        {
            Desde = desde,
            Hasta = hasta,
            Total = lista.Sum(a => a.Monto),
            CantidadPagos = lista.Count,
            PorMetodo = metodos
                .Select(m => new PagosPorMetodoDto
                {
                    IdMetodoPago = m.IdMetodoPago,
                    MetodoPago = m.NombreMetodoPago,
                    Total = lista.Where(a => a.IdMetodoPago == m.IdMetodoPago).Sum(a => a.Monto),
                    CantidadPagos = lista.Count(a => a.IdMetodoPago == m.IdMetodoPago),
                })
                .ToList(),
        };
    }
}
