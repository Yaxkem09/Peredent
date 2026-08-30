using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Controllers;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;
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

    [Fact]
    public async Task GetByPaciente_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db);

        var resultado = await controller.GetByPaciente(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Guardar_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db);

        var resultado = await controller.Guardar(999, new GuardarPlanTratamientoDto());

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Guardar_ConPiezas_SeGuardaComoPendienteYSeRecuperaConGet()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db);

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

    [Fact]
    public async Task Guardar_ValorNegativo_Devuelve400()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db);

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
        var controller = new PlanTratamientoController(db);

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
        var controller = new PlanTratamientoController(db);

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
        var controller = new PlanTratamientoController(db);

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
        var controller = new PlanTratamientoController(db);

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
        var controller = new PlanTratamientoController(db);

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
        var controller = new PlanTratamientoController(db);

        var resultado = await controller.Finalizar(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Finalizar_SinPlanActivo_Devuelve404()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db);

        var resultado = await controller.Finalizar(paciente.IdPaciente);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Finalizar_CierraElPlanYElSiguienteGuardadoCreaUnoNuevoSinPerderElAnterior()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db);

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Resina compuesta", Valor = 800 } },
        });

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
    public async Task GetHistorial_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new PlanTratamientoController(db);

        var resultado = await controller.GetHistorial(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task GetHistorial_SinPlanesCerrados_DevuelveListaVacia()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db);

        var historial = ExtraerLista(await controller.GetHistorial(paciente.IdPaciente));

        Assert.Empty(historial);
    }

    [Fact]
    public async Task GetHistorial_DevuelvePlanesCerradosOrdenadosPorFechaCierreDescendente()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new PlanTratamientoController(db);

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "16", Tratamiento = "Resina compuesta", Valor = 800 } },
        });
        await controller.Finalizar(paciente.IdPaciente);

        await controller.Guardar(paciente.IdPaciente, new GuardarPlanTratamientoDto
        {
            Piezas = new List<PiezaPlanDto> { new() { Pieza = "15", Tratamiento = "Endodoncia", Valor = 2500 } },
        });
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
}
