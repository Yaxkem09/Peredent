using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Controllers;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Controllers;

public class PlanTratamientoControllerTests
{
    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static async Task SembrarEstadosAsync(ApplicationDbContext db)
    {
        db.EstadosTratamiento.Add(new EstadoTratamiento { IdEstadoTratamiento = 1, Nombre = "Pendiente" });
        db.EstadosTratamiento.Add(new EstadoTratamiento { IdEstadoTratamiento = 2, Nombre = "Completado" });
        await db.SaveChangesAsync();
    }

    private static async Task<Paciente> CrearPacienteAsync(ApplicationDbContext db)
    {
        var paciente = new Paciente
        {
            Nombres = "Juan",
            Apellidos = "Pérez",
            FechaNacimiento = new DateTime(1990, 1, 1),
            Telefono = "5555-5555",
            FechaRegistro = DateTime.UtcNow,
        };
        db.Pacientes.Add(paciente);
        await db.SaveChangesAsync();
        return paciente;
    }

    private static PlanTratamientoDto ExtraerDto(ActionResult<PlanTratamientoDto> resultado)
    {
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsType<PlanTratamientoDto>(ok.Value);
    }

    private static List<PlanTratamientoDto> ExtraerLista(ActionResult<IEnumerable<PlanTratamientoDto>> resultado)
    {
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsAssignableFrom<IEnumerable<PlanTratamientoDto>>(ok.Value).ToList();
    }

    private static List<TratamientoPendienteDto> ExtraerPendientes(ActionResult<IEnumerable<TratamientoPendienteDto>> resultado)
    {
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsAssignableFrom<IEnumerable<TratamientoPendienteDto>>(ok.Value).ToList();
    }

    private static List<HistorialTratamientoDto> ExtraerHistorialTratamientos(ActionResult<IEnumerable<HistorialTratamientoDto>> resultado)
    {
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsAssignableFrom<IEnumerable<HistorialTratamientoDto>>(ok.Value).ToList();
    }

    private static PresupuestoDto ExtraerPresupuesto(ActionResult<PresupuestoDto> resultado)
    {
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsType<PresupuestoDto>(ok.Value);
    }

    [Fact]
    public async Task GetByPaciente_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.GetByPaciente(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Guardar_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.Guardar(999, new GuardarPlanTratamientoDto());

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Guardar_ConPiezas_SeGuardaComoPendienteYSeRecuperaConGet()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var request = new GuardarPlanTratamientoDto
        {
            Descuento = 50,
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 },
                new() { Pieza = "21l", Tratamiento = "Endodoncia", Valor = 800 },
                new() { Pieza = "1", Tratamiento = "", Valor = 0 }, // renglón vacío, no debe guardarse
            },
        };

        var guardado = ExtraerDto(await controller.Guardar(paciente.IdPaciente, request));

        Assert.Equal(2, guardado.Piezas.Count);
        Assert.Equal(1050, guardado.Subtotal);
        Assert.Equal(50, guardado.Descuento);
        Assert.Equal(1000, guardado.Total);
        Assert.All(guardado.Piezas, p => Assert.Equal("Pendiente", p.Estado));

        var recuperado = ExtraerDto(await controller.GetByPaciente(paciente.IdPaciente));

        Assert.Equal(2, recuperado.Piezas.Count);
        Assert.Equal("Obturación", recuperado.Piezas.Single(p => p.Pieza == "16").Tratamiento);
        Assert.Equal(800, recuperado.Piezas.Single(p => p.Pieza == "21l").Valor);
    }

    // Mismo bug que en el presupuesto: las piezas se guardan con su etiqueta
    // ("4a", "10g", ...), así que ordenarlas como texto las deja alfabéticas en
    // vez de en el orden numérico 1 a 32 que espera el historial de planes.
    [Fact]
    public async Task GetByPaciente_OrdenaLasPiezasNumericamenteNoAlfabeticamente()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "21l", Tratamiento = "Endodoncia", Valor = 800 },
                new() { Pieza = "2", Tratamiento = "Limpieza", Valor = 300 },
                new() { Pieza = "10g", Tratamiento = "Obturación", Valor = 250 },
                new() { Pieza = "1", Tratamiento = "Limpieza", Valor = 300 },
            },
        });

        var recuperado = ExtraerDto(await controller.GetByPaciente(paciente.IdPaciente));

        Assert.Equal(new[] { "1", "2", "10g", "21l" }, recuperado.Piezas.Select(p => p.Pieza));
    }

    [Fact]
    public async Task Guardar_ValorNegativo_Devuelve400()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var request = new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = -10 } },
        };

        var resultado = await controller.Guardar(paciente.IdPaciente, request);

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Guardar_TratamientoSinValor_Devuelve400YNoGuardaNada()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var request = new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = 0 } },
        };

        var resultado = await controller.Guardar(paciente.IdPaciente, request);

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Empty(await db.PlanesTratamiento.ToListAsync());
    }

    [Fact]
    public async Task Guardar_Update_ActualizaValorSinDuplicarLaPieza()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 } },
        });

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = 300 } },
        });

        var filas = await db.PlanesTratamiento.ToListAsync();

        var fila = Assert.Single(filas);
        Assert.Equal(300, fila.Valor);
    }

    [Fact]
    public async Task Guardar_Update_QuitaPiezasVaciadasSinDejarHuerfanas()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 },
                new() { Pieza = "21l", Tratamiento = "Endodoncia", Valor = 800 },
            },
        });

        // El usuario borra el tratamiento de la pieza 16 en el frontend.
        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "16", Tratamiento = "", Valor = 0 },
                new() { Pieza = "21l", Tratamiento = "Endodoncia", Valor = 800 },
            },
        });

        var filas = await db.PlanesTratamiento.ToListAsync();

        var fila = Assert.Single(filas);
        Assert.Equal("21l", fila.Pieza);
    }

    [Fact]
    public async Task Guardar_Update_NoDegradaUnaPiezaYaCompletadaAPendiente()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 } },
        });

        var idCompletado = (await db.EstadosTratamiento.SingleAsync(e => e.Nombre == "Completado")).IdEstadoTratamiento;
        var fila = await db.PlanesTratamiento.SingleAsync();
        fila.IdEstadoTratamiento = idCompletado;
        await db.SaveChangesAsync();

        // El odontólogo solo corrige el valor; no debería revertir el estado a Pendiente.
        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = 275 } },
        });

        var recuperado = ExtraerDto(await controller.GetByPaciente(paciente.IdPaciente));

        var piezaActualizada = Assert.Single(recuperado.Piezas);
        Assert.Equal(275, piezaActualizada.Valor);
        Assert.Equal("Completado", piezaActualizada.Estado);
    }

    [Fact]
    public async Task Guardar_DescuentoMayorQueElSubtotal_TotalNoEsNegativo()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var request = new GuardarPlanTratamientoDto
        {
            Descuento = 5000,
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 } },
        };

        var guardado = ExtraerDto(await controller.Guardar(paciente.IdPaciente, request));

        Assert.Equal(0, guardado.Total);
    }

    [Fact]
    public async Task Finalizar_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.Finalizar(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Finalizar_SinPlanActivo_Devuelve404()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.Finalizar(paciente.IdPaciente);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Finalizar_ConPiezasSinCompletar_Devuelve400YNoCierraElPlan()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "16", Tratamiento = "Resina compuesta", Valor = 800 },
                new() { Pieza = "15", Tratamiento = "Endodoncia", Valor = 2500 },
            },
        });
        await controller.MarcarCompletado(paciente.IdPaciente, "16");

        var resultado = await controller.Finalizar(paciente.IdPaciente);

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        var recuperado = ExtraerDto(await controller.GetByPaciente(paciente.IdPaciente));
        Assert.NotEmpty(recuperado.Piezas);
        Assert.Empty(ExtraerLista(await controller.GetHistorial(paciente.IdPaciente)));
    }

    [Fact]
    public async Task Finalizar_CierraElPlanYElSiguienteGuardadoCreaUnoNuevoSinPerderElAnterior()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Resina compuesta", Valor = 800 } },
        });
        await controller.MarcarCompletado(paciente.IdPaciente, "16");

        var finalizado = ExtraerDto(await controller.Finalizar(paciente.IdPaciente));
        Assert.Empty(finalizado.Piezas);

        var activoTrasFinalizar = ExtraerDto(await controller.GetByPaciente(paciente.IdPaciente));
        Assert.Empty(activoTrasFinalizar.Piezas);

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "15", Tratamiento = "Endodoncia", Valor = 2500 } },
        });

        var nuevoActivo = ExtraerDto(await controller.GetByPaciente(paciente.IdPaciente));
        var piezaNueva = Assert.Single(nuevoActivo.Piezas);
        Assert.Equal("15", piezaNueva.Pieza);

        var historial = ExtraerLista(await controller.GetHistorial(paciente.IdPaciente));
        var planCerrado = Assert.Single(historial);
        var piezaHistorica = Assert.Single(planCerrado.Piezas);
        Assert.Equal("16", piezaHistorica.Pieza);
    }

    [Fact]
    public async Task GetPendientes_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.GetPendientes(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task GetPendientes_SinPlanActivo_DevuelveListaVacia()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var pendientes = ExtraerPendientes(await controller.GetPendientes(paciente.IdPaciente));

        Assert.Empty(pendientes);
    }

    [Fact]
    public async Task GetPendientes_SoloDevuelveLasPiezasEnEstadoPendienteDelPlanActivo()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 },
                new() { Pieza = "21l", Tratamiento = "Endodoncia", Valor = 800 },
            },
        });
        await controller.MarcarCompletado(paciente.IdPaciente, "16");

        var pendientes = ExtraerPendientes(await controller.GetPendientes(paciente.IdPaciente));

        var pendiente = Assert.Single(pendientes);
        Assert.Equal("21l", pendiente.Pieza);
        Assert.Equal("Endodoncia", pendiente.Tratamiento);
        Assert.Equal(800, pendiente.Valor);
    }

    [Fact]
    public async Task MarcarCompletado_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.MarcarCompletado(999, "16");

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task MarcarCompletado_SinPlanActivo_Devuelve404()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.MarcarCompletado(paciente.IdPaciente, "16");

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task MarcarCompletado_PiezaInexistenteEnElPlanActivo_Devuelve404()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 } },
        });

        var resultado = await controller.MarcarCompletado(paciente.IdPaciente, "21l");

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task MarcarCompletado_ActualizaEstadoYFechaFinYDesapareceDeLosPendientes()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 } },
        });

        var pendientesTrasCompletar = ExtraerPendientes(await controller.MarcarCompletado(paciente.IdPaciente, "16"));
        Assert.Empty(pendientesTrasCompletar);

        var fila = await db.PlanesTratamiento.SingleAsync();
        Assert.Equal("Completado", (await db.EstadosTratamiento.SingleAsync(e => e.IdEstadoTratamiento == fila.IdEstadoTratamiento)).Nombre);
        Assert.NotNull(fila.FechaFinTratamiento);

        var recuperado = ExtraerDto(await controller.GetByPaciente(paciente.IdPaciente));
        Assert.Equal("Completado", Assert.Single(recuperado.Piezas).Estado);
    }

    [Fact]
    public async Task GetHistorial_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.GetHistorial(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task GetHistorial_SinPlanesCerrados_DevuelveListaVacia()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var historial = ExtraerLista(await controller.GetHistorial(paciente.IdPaciente));

        Assert.Empty(historial);
    }

    [Fact]
    public async Task GetHistorial_DevuelvePlanesCerradosOrdenadosPorFechaCierreDescendente()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Resina compuesta", Valor = 800 } },
        });
        await controller.MarcarCompletado(paciente.IdPaciente, "16");
        await controller.Finalizar(paciente.IdPaciente);

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "15", Tratamiento = "Endodoncia", Valor = 2500 } },
        });
        await controller.MarcarCompletado(paciente.IdPaciente, "15");
        await controller.Finalizar(paciente.IdPaciente);

        // Forzamos fechas de cierre distintas (ambas quedaron "hoy") para poder verificar el orden.
        var cerrados = await db.PresupuestosPlan
            .Where(p => p.IdPaciente == paciente.IdPaciente)
            .OrderBy(p => p.IdPresupuestoPlan)
            .ToListAsync();
        cerrados[0].FechaCierre = new DateTime(2026, 1, 1);
        cerrados[1].FechaCierre = new DateTime(2026, 6, 1);
        await db.SaveChangesAsync();

        var historial = ExtraerLista(await controller.GetHistorial(paciente.IdPaciente));

        Assert.Equal(2, historial.Count);
        Assert.Equal(new DateTime(2026, 6, 1), historial[0].FechaCierre);
        Assert.Equal(new DateTime(2026, 1, 1), historial[1].FechaCierre);
    }

    [Fact]
    public async Task GetHistorialTratamientos_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.GetHistorialTratamientos(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task GetHistorialTratamientos_SoloDevuelveLasPiezasCompletadas()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "16", Tratamiento = "Resina compuesta", Valor = 800 },
                new() { Pieza = "21l", Tratamiento = "Endodoncia", Valor = 2500 },
            },
        });
        await controller.MarcarCompletado(paciente.IdPaciente, "16");

        var historial = ExtraerHistorialTratamientos(await controller.GetHistorialTratamientos(paciente.IdPaciente));

        var renglon = Assert.Single(historial);
        Assert.Equal("16", renglon.Pieza);
        Assert.Equal("Resina compuesta", renglon.Tratamiento);
    }

    [Fact]
    public async Task GetHistorialTratamientos_IncluyePlanesCerradosYActivosDeMasRecienteAMasAntiguo()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        // Plan 1: se completa una pieza y luego se cierra.
        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Resina compuesta", Valor = 800 } },
        });
        await controller.MarcarCompletado(paciente.IdPaciente, "16");
        await controller.Finalizar(paciente.IdPaciente);

        // Plan 2 (activo): otra pieza completada.
        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "15", Tratamiento = "Endodoncia", Valor = 2500 } },
        });
        await controller.MarcarCompletado(paciente.IdPaciente, "15");

        // Forzamos fechas de fin distintas para poder verificar el orden cronológico.
        var filas = await db.PlanesTratamiento.OrderBy(pt => pt.IdPlanTratamiento).ToListAsync();
        filas[0].FechaFinTratamiento = new DateTime(2026, 1, 10);
        filas[1].FechaFinTratamiento = new DateTime(2026, 8, 20);
        await db.SaveChangesAsync();

        var historial = ExtraerHistorialTratamientos(await controller.GetHistorialTratamientos(paciente.IdPaciente));

        Assert.Equal(2, historial.Count);
        Assert.Equal("15", historial[0].Pieza);
        Assert.Equal(new DateTime(2026, 8, 20), historial[0].Fecha);
        Assert.Equal("16", historial[1].Pieza);
        Assert.Equal(new DateTime(2026, 1, 10), historial[1].Fecha);
    }

    [Fact]
    public async Task GetPresupuesto_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.GetPresupuesto(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task GetPresupuesto_SinPlan_DevuelveTienePlanFalse()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var presupuesto = ExtraerPresupuesto(await controller.GetPresupuesto(paciente.IdPaciente));

        Assert.False(presupuesto.TienePlan);
        Assert.Empty(presupuesto.Detalle);
        Assert.Equal(0, presupuesto.Total);
        Assert.Equal("Juan Pérez", presupuesto.NombrePaciente);
    }

    // SCRUM-79: el documento incluye el detalle de piezas, tratamientos y valores
    // del plan reciente, más el subtotal, descuento y total.
    [Fact]
    public async Task GetPresupuesto_ConPlanActivo_DevuelveDetalleYTotales()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Descuento = 50,
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 },
                new() { Pieza = "21l", Tratamiento = "Endodoncia", Valor = 800 },
                new() { Pieza = "1", Tratamiento = "", Valor = 0 }, // renglón vacío, no entra al presupuesto
            },
        });

        var presupuesto = ExtraerPresupuesto(await controller.GetPresupuesto(paciente.IdPaciente));

        Assert.True(presupuesto.TienePlan);
        // La fecha de emisión es una fecha de calendario, no un instante UTC: si
        // se serializara con Kind=Utc saldría con sufijo "Z" y el frontend la
        // mostraría un día antes al convertirla a hora de Guatemala.
        Assert.Equal(DateTimeKind.Unspecified, presupuesto.FechaEmision.Kind);
        Assert.Equal(DateTime.UtcNow.AddHours(-6).Date, presupuesto.FechaEmision);
        Assert.Equal(2, presupuesto.Detalle.Count);
        Assert.Equal("Obturación", presupuesto.Detalle.Single(l => l.Pieza == "16").Tratamiento);
        Assert.Equal(800, presupuesto.Detalle.Single(l => l.Pieza == "21l").Valor);
        Assert.Equal(1050, presupuesto.Subtotal);
        Assert.Equal(50, presupuesto.Descuento);
        Assert.Equal(1000, presupuesto.Total);
    }

    // Las piezas se guardan con su etiqueta ("4a", "10g", "21l", ...), no con el
    // número de PIEZAS_DENTALES; ordenar por esa cadena las deja alfabéticas
    // (1, 10g, 11h, ... 2, 20, ...) en vez de 1 a 32.
    [Fact]
    public async Task GetPresupuesto_OrdenaLasPiezasNumericamenteNoAlfabeticamente()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "21l", Tratamiento = "Endodoncia", Valor = 800 },
                new() { Pieza = "2", Tratamiento = "Limpieza", Valor = 300 },
                new() { Pieza = "10g", Tratamiento = "Obturación", Valor = 250 },
                new() { Pieza = "1", Tratamiento = "Limpieza", Valor = 300 },
            },
        });

        var presupuesto = ExtraerPresupuesto(await controller.GetPresupuesto(paciente.IdPaciente));

        Assert.Equal(new[] { "1", "2", "10g", "21l" }, presupuesto.Detalle.Select(l => l.Pieza));
    }

    // SCRUM-205: el presupuesto se actualiza cuando el plan reciente se actualiza.
    [Fact]
    public async Task GetPresupuesto_ReflejaLosCambiosGuardadosEnElPlan()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 } },
        });

        var antes = ExtraerPresupuesto(await controller.GetPresupuesto(paciente.IdPaciente));
        Assert.Equal(250, antes.Total);

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Descuento = 100,
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "16", Tratamiento = "Corona", Valor = 900 },
                new() { Pieza = "24", Tratamiento = "Obturación", Valor = 300 },
            },
        });

        var despues = ExtraerPresupuesto(await controller.GetPresupuesto(paciente.IdPaciente));

        Assert.Equal(2, despues.Detalle.Count);
        Assert.Equal("Corona", despues.Detalle.Single(l => l.Pieza == "16").Tratamiento);
        Assert.Equal(1200, despues.Subtotal);
        Assert.Equal(100, despues.Descuento);
        Assert.Equal(1100, despues.Total);
    }

    // El presupuesto es para firmar antes de iniciar el tratamiento: si el
    // paciente ya no tiene un plan activo (el único que tuvo se finalizó), no
    // se debe mostrar el detalle de ese plan viejo, sino el estado sin plan.
    [Fact]
    public async Task GetPresupuesto_SinPlanActivo_NoMuestraElUltimoPlanCerrado()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 } },
        });
        await controller.MarcarCompletado(paciente.IdPaciente, "16");
        await controller.Finalizar(paciente.IdPaciente);

        var presupuesto = ExtraerPresupuesto(await controller.GetPresupuesto(paciente.IdPaciente));

        Assert.False(presupuesto.TienePlan);
        Assert.Empty(presupuesto.Detalle);
        Assert.Equal(0, presupuesto.Total);
    }

    // SCRUM-80: el presupuesto incluye la leyenda de conformidad.
    [Fact]
    public async Task GetPresupuesto_IncluyeLaLeyendaDeConformidad()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var presupuesto = ExtraerPresupuesto(await controller.GetPresupuesto(paciente.IdPaciente));

        Assert.Contains("sujeto a cambios imprevistos", presupuesto.LeyendaConformidad);
    }

    [Fact]
    public async Task GetPresupuestoPdf_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.GetPresupuestoPdf(999);

        Assert.IsType<NotFoundObjectResult>(resultado);
    }

    [Fact]
    public async Task GetPresupuestoPdf_SinPlan_Devuelve400()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        var resultado = await controller.GetPresupuestoPdf(paciente.IdPaciente);

        Assert.IsType<BadRequestObjectResult>(resultado);
    }

    // SCRUM-78: el presupuesto se puede exportar en PDF.
    [Fact]
    public async Task GetPresupuestoPdf_ConPlan_DevuelveArchivoPdf()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db, new PlanTratamientoService(db), new PresupuestoPdfService());

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Descuento = 50,
            Piezas = new List<PiezaPlanDto>
            {
                new() { Pieza = "16", Tratamiento = "Obturación", Valor = 250 },
                new() { Pieza = "21l", Tratamiento = "Endodoncia", Valor = 800 },
            },
        });

        var resultado = await controller.GetPresupuestoPdf(paciente.IdPaciente);

        var archivo = Assert.IsType<FileContentResult>(resultado);
        Assert.Equal("application/pdf", archivo.ContentType);
        Assert.EndsWith(".pdf", archivo.FileDownloadName);
        // Firma de un archivo PDF válido: los bytes arrancan con "%PDF-".
        Assert.True(archivo.FileContents.Length > 0);
        Assert.Equal("%PDF-", System.Text.Encoding.ASCII.GetString(archivo.FileContents, 0, 5));
    }
}
