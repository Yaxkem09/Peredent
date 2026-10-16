using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Controllers;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Helpers;
using Peredent.Api.Models;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Controllers;

public class DashboardControllerTests
{
    private const int Efectivo = 1;
    private const int Transferencia = 2;

    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new ApplicationDbContext(options);
        db.MetodosPago.AddRange(
            new MetodoPago { IdMetodoPago = Efectivo, NombreMetodoPago = "Efectivo" },
            new MetodoPago { IdMetodoPago = Transferencia, NombreMetodoPago = "Transferencia" });
        db.SaveChanges();
        return db;
    }

    private static AbonoPaciente Abono(DateTime fecha, decimal monto, int idMetodoPago, bool anulado = false) => new()
    {
        IdPresupuestoPlan = 1,
        IdUsuario = 1,
        FechaAbono = fecha,
        MontoAbono = monto,
        IdMetodoPago = idMetodoPago,
        Anulado = anulado,
    };

    private static DateTime LunesDeEstaSemana()
    {
        var hoy = FechaGuatemala.Hoy();
        return hoy.AddDays(-(((int)hoy.DayOfWeek + 6) % 7));
    }

    private static async Task<ResumenPagosDto> ObtenerResumenAsync(ApplicationDbContext db, DateTime? semana = null)
    {
        var resultado = await new DashboardController(db).GetResumenPagos(semana);
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsType<ResumenPagosDto>(ok.Value);
    }

    // SCRUM-273: solo el odontólogo ve el resumen.
    [Fact]
    public void Controller_SoloRolOdontologo()
    {
        var authorize = typeof(DashboardController).GetCustomAttribute<AuthorizeAttribute>();

        Assert.NotNull(authorize);
        Assert.Equal("Odontologo", authorize!.Roles);
    }

    // SCRUM-270 / SCRUM-272: total del día, desglosado por método.
    [Fact]
    public async Task GetResumenPagos_Hoy_SumaPorMetodoYExcluyeAnulados()
    {
        using var db = CrearContexto();
        var ahora = FechaGuatemala.Ahora();
        db.AbonosPaciente.AddRange(
            Abono(ahora, 100m, Efectivo),
            Abono(ahora, 50m, Transferencia),
            Abono(ahora, 999m, Efectivo, anulado: true));
        await db.SaveChangesAsync();

        var resumen = await ObtenerResumenAsync(db);

        Assert.Equal(150m, resumen.Hoy.Total);
        Assert.Equal(2, resumen.Hoy.CantidadPagos);
        Assert.Equal(100m, resumen.Hoy.PorMetodo.Single(m => m.IdMetodoPago == Efectivo).Total);
        Assert.Equal(50m, resumen.Hoy.PorMetodo.Single(m => m.IdMetodoPago == Transferencia).Total);
    }

    // SCRUM-271: la semana va de lunes a domingo; lo de la semana anterior no cuenta.
    [Fact]
    public async Task GetResumenPagos_Semana_SoloCuentaDeLunesADomingo()
    {
        using var db = CrearContexto();
        var lunes = LunesDeEstaSemana();
        db.AbonosPaciente.AddRange(
            Abono(lunes.AddHours(8), 200m, Efectivo),
            Abono(lunes.AddDays(6).AddHours(23), 75m, Transferencia),
            Abono(lunes.AddMinutes(-1), 500m, Efectivo),
            Abono(lunes.AddDays(7), 300m, Efectivo));
        await db.SaveChangesAsync();

        var resumen = await ObtenerResumenAsync(db);

        Assert.Equal(lunes, resumen.Semana.Desde);
        Assert.Equal(lunes.AddDays(6), resumen.Semana.Hasta);
        Assert.Equal(275m, resumen.Semana.Total);
        Assert.Equal(2, resumen.Semana.CantidadPagos);

        // Desglose por día: lunes a domingo, con cada pago en su día.
        Assert.Equal(7, resumen.Dias.Count);
        Assert.Equal(lunes, resumen.Dias[0].Desde);
        Assert.Equal(200m, resumen.Dias[0].Total);
        Assert.Equal(75m, resumen.Dias[6].Total);
        Assert.Equal(0m, resumen.Dias[3].Total);
    }

    [Fact]
    public async Task GetResumenPagos_SinPagos_DevuelveCerosConTodosLosMetodos()
    {
        using var db = CrearContexto();

        var resumen = await ObtenerResumenAsync(db);

        Assert.Equal(0m, resumen.Hoy.Total);
        Assert.Equal(0m, resumen.Semana.Total);
        Assert.Equal(2, resumen.Semana.PorMetodo.Count);
        Assert.All(resumen.Semana.PorMetodo, m => Assert.Equal(0m, m.Total));
    }

    // Semanas anteriores: con una fecha cualquiera se consulta la semana que la
    // contiene; "Hoy" sigue siendo el día actual.
    [Fact]
    public async Task GetResumenPagos_SemanaAnterior_DevuelveEsaSemanaYHoySigueSiendoHoy()
    {
        using var db = CrearContexto();
        var lunesAnterior = LunesDeEstaSemana().AddDays(-7);
        db.AbonosPaciente.AddRange(
            Abono(lunesAnterior.AddDays(2).AddHours(10), 120m, Efectivo),
            Abono(FechaGuatemala.Ahora(), 40m, Transferencia));
        await db.SaveChangesAsync();

        var resumen = await ObtenerResumenAsync(db, lunesAnterior.AddDays(4));

        Assert.False(resumen.EsSemanaActual);
        Assert.Equal(lunesAnterior, resumen.Semana.Desde);
        Assert.Equal(120m, resumen.Semana.Total);
        Assert.Equal(120m, resumen.Dias[2].Total);
        Assert.Equal(40m, resumen.Hoy.Total);
    }

    [Fact]
    public async Task GetResumenPagos_SemanaFutura_SeTomaComoLaActual()
    {
        using var db = CrearContexto();

        var resumen = await ObtenerResumenAsync(db, FechaGuatemala.Hoy().AddDays(30));

        Assert.True(resumen.EsSemanaActual);
        Assert.Equal(LunesDeEstaSemana(), resumen.Semana.Desde);
    }

    // Top de saldos: suma los planes que deben, descuenta abonos no anulados,
    // ignora saldos a favor y ordena de mayor a menor.
    [Fact]
    public async Task GetSaldosPendientes_OrdenaPorSaldoYExcluyeLosQueNoDeben()
    {
        using var db = CrearContexto();
        db.Pacientes.AddRange(
            new Paciente { IdPaciente = 1, Nombres = "Ana", Apellidos = "López", Telefono = "11111111" },
            new Paciente { IdPaciente = 2, Nombres = "Beto", Apellidos = "Pérez", Telefono = "22222222" },
            new Paciente { IdPaciente = 3, Nombres = "Carla", Apellidos = "Ruiz", Telefono = "33333333" });
        db.PresupuestosPlan.AddRange(
            Plan(10, idPaciente: 1, descuento: 50m, 300m, 200m),  // total 450
            Plan(11, idPaciente: 1, descuento: 0m, 100m),          // total 100, a favor
            Plan(20, idPaciente: 2, descuento: 0m, 1000m),         // total 1000
            Plan(30, idPaciente: 3, descuento: 0m, 200m));         // total 200, pagado
        db.AbonosPaciente.AddRange(
            AbonoPlan(10, 100m),
            AbonoPlan(10, 999m, anulado: true),
            AbonoPlan(11, 150m),
            AbonoPlan(20, 300m),
            AbonoPlan(30, 200m));
        await db.SaveChangesAsync();

        var resultado = await new DashboardController(db).GetSaldosPendientes();

        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        var saldos = Assert.IsType<SaldosPendientesDto>(ok.Value);
        var lista = saldos.Pacientes;
        Assert.Equal(2, saldos.TotalPacientes);
        Assert.Equal(1050m, saldos.TotalPorCobrar);
        Assert.Equal(2, lista.Count);
        Assert.Equal("Beto Pérez", lista[0].NombrePaciente);
        Assert.Equal(700m, lista[0].SaldoPendiente);
        Assert.Equal(1, lista[1].IdPaciente);
        Assert.Equal(350m, lista[1].SaldoPendiente);
        Assert.Equal(1, lista[1].PlanesConSaldo);
    }

    // Por defecto el top 10; con todos=true la lista completa. Los totales
    // siempre cuentan a todos los que deben.
    [Theory]
    [InlineData(false, 10)]
    [InlineData(true, 12)]
    public async Task GetSaldosPendientes_TopDiezOTodos(bool todos, int esperados)
    {
        using var db = CrearContexto();
        for (var i = 1; i <= 12; i++)
        {
            db.Pacientes.Add(new Paciente { IdPaciente = i, Nombres = $"P{i}", Apellidos = "X", Telefono = "12345678" });
            db.PresupuestosPlan.Add(Plan(100 + i, idPaciente: i, descuento: 0m, i * 10m));
        }
        await db.SaveChangesAsync();

        var resultado = await new DashboardController(db).GetSaldosPendientes(todos);

        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        var saldos = Assert.IsType<SaldosPendientesDto>(ok.Value);
        Assert.Equal(esperados, saldos.Pacientes.Count);
        Assert.Equal(12, saldos.Pacientes[0].IdPaciente);
        Assert.Equal(12, saldos.TotalPacientes);
        Assert.Equal(780m, saldos.TotalPorCobrar);
    }

    private static PresupuestoPlan Plan(int id, int idPaciente, decimal descuento, params decimal[] valores) => new()
    {
        IdPresupuestoPlan = id,
        IdPaciente = idPaciente,
        FechaInicioPlan = FechaGuatemala.Hoy(),
        CantidadDescuento = descuento,
        Piezas = valores.Select((v, i) => new PlanTratamiento { Pieza = $"{id}-{i}", Tratamiento = "T", Valor = v }).ToList(),
    };

    private static AbonoPaciente AbonoPlan(int idPlan, decimal monto, bool anulado = false) => new()
    {
        IdPresupuestoPlan = idPlan,
        IdUsuario = 1,
        FechaAbono = FechaGuatemala.Ahora().AddDays(-40),
        MontoAbono = monto,
        IdMetodoPago = Efectivo,
        Anulado = anulado,
    };
}
