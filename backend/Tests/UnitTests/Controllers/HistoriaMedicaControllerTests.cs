using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Controllers;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Controllers;

public class HistoriaMedicaControllerTests
{
    private static readonly string[] NombresCatalogo =
    {
        "Problemas cardíacos", "Enfermedades renales", "Diabetes", "Hipertensión", "Epilepsia",
        "Alergias", "Problemas hemorrágicos", "Embarazo", "Medicación", "Problemas con Tx dental",
    };

    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static async Task SembrarCatalogoAsync(ApplicationDbContext db)
    {
        for (var i = 0; i < NombresCatalogo.Length; i++)
        {
            db.Condiciones.Add(new Condicion { IdCondicion = i + 1, NombreCondicion = NombresCatalogo[i] });
        }

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

    private static HistoriaMedicaDto ExtraerDto(ActionResult<HistoriaMedicaDto> resultado)
    {
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsType<HistoriaMedicaDto>(ok.Value);
    }

    [Fact]
    public async Task GetByPaciente_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new HistoriaMedicaController(db);

        var resultado = await controller.GetByPaciente(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Guardar_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new HistoriaMedicaController(db);

        var resultado = await controller.Guardar(999, new GuardarHistoriaMedicaDto());

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Guardar_ConCondicionesMarcadas_SeGuardaYSeRecuperaConGet()
    {
        using var db = CrearContexto();
        await SembrarCatalogoAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new HistoriaMedicaController(db);

        var request = new GuardarHistoriaMedicaDto
        {
            ObservacionesGenerales = "Paciente colabora bien.",
            Condiciones = new List<CondicionSeleccionadaDto>
            {
                new() { IdCondicion = 3, Observacion = "Tipo 2, controlada" }, // Diabetes
                new() { IdCondicion = 6, Observacion = "Alérgica a la penicilina" }, // Alergias
            },
        };

        var guardado = ExtraerDto(await controller.Guardar(paciente.IdPaciente, request));

        Assert.Equal(10, guardado.Condiciones.Count);
        Assert.True(guardado.Condiciones.Single(c => c.IdCondicion == 3).Marcada);
        Assert.Equal("Tipo 2, controlada", guardado.Condiciones.Single(c => c.IdCondicion == 3).Observacion);
        Assert.False(guardado.Condiciones.Single(c => c.IdCondicion == 1).Marcada);

        var recuperado = ExtraerDto(await controller.GetByPaciente(paciente.IdPaciente));

        Assert.Equal("Paciente colabora bien.", recuperado.ObservacionesGenerales);
        Assert.True(recuperado.Condiciones.Single(c => c.IdCondicion == 3).Marcada);
        Assert.True(recuperado.Condiciones.Single(c => c.IdCondicion == 6).Marcada);
    }

    [Fact]
    public async Task Guardar_CondicionMarcadaSinObservacion_SeGuardaYSeRecuperaConObservacionNula()
    {
        using var db = CrearContexto();
        await SembrarCatalogoAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new HistoriaMedicaController(db);

        var request = new GuardarHistoriaMedicaDto
        {
            Condiciones = new List<CondicionSeleccionadaDto>
            {
                new() { IdCondicion = 3, Observacion = null }, // diabético, sin nota adicional
            },
        };

        await controller.Guardar(paciente.IdPaciente, request);
        var recuperado = ExtraerDto(await controller.GetByPaciente(paciente.IdPaciente));

        var diabetes = recuperado.Condiciones.Single(c => c.IdCondicion == 3);
        Assert.True(diabetes.Marcada);
        Assert.Null(diabetes.Observacion);
    }

    [Fact]
    public async Task Guardar_Update_NoDuplicaLaCondicionQueSeMantieneMarcada()
    {
        using var db = CrearContexto();
        await SembrarCatalogoAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new HistoriaMedicaController(db);

        await controller.Guardar(paciente.IdPaciente, new GuardarHistoriaMedicaDto
        {
            Condiciones = new List<CondicionSeleccionadaDto> { new() { IdCondicion = 3, Observacion = "primera vez" } },
        });

        await controller.Guardar(paciente.IdPaciente, new GuardarHistoriaMedicaDto
        {
            Condiciones = new List<CondicionSeleccionadaDto>
            {
                new() { IdCondicion = 3, Observacion = "actualizada" },
                new() { IdCondicion = 6, Observacion = "nueva" },
            },
        });

        var filas = await db.HistoriasCondiciones.ToListAsync();

        Assert.Equal(2, filas.Count);
        var filaDiabetes = Assert.Single(filas, f => f.IdCondicion == 3);
        Assert.Equal("actualizada", filaDiabetes.ObservacionCondicion);
    }

    [Fact]
    public async Task Guardar_Update_QuitaCondicionesDesmarcadasSinDejarHuerfanas()
    {
        using var db = CrearContexto();
        await SembrarCatalogoAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new HistoriaMedicaController(db);

        await controller.Guardar(paciente.IdPaciente, new GuardarHistoriaMedicaDto
        {
            Condiciones = new List<CondicionSeleccionadaDto> { new() { IdCondicion = 3 }, new() { IdCondicion = 6 } },
        });

        await controller.Guardar(paciente.IdPaciente, new GuardarHistoriaMedicaDto
        {
            Condiciones = new List<CondicionSeleccionadaDto> { new() { IdCondicion = 3 } },
        });

        var filas = await db.HistoriasCondiciones.ToListAsync();

        var fila = Assert.Single(filas);
        Assert.Equal(3, fila.IdCondicion);
    }

    [Fact]
    public async Task Guardar_IdCondicionInexistente_Devuelve400_YNoModificaLaHistoria()
    {
        using var db = CrearContexto();
        await SembrarCatalogoAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var controller = new HistoriaMedicaController(db);

        await controller.Guardar(paciente.IdPaciente, new GuardarHistoriaMedicaDto
        {
            ObservacionesGenerales = "Estado inicial",
            Condiciones = new List<CondicionSeleccionadaDto> { new() { IdCondicion = 3, Observacion = "ok" } },
        });

        var resultado = await controller.Guardar(paciente.IdPaciente, new GuardarHistoriaMedicaDto
        {
            ObservacionesGenerales = "Esto no debería guardarse",
            Condiciones = new List<CondicionSeleccionadaDto> { new() { IdCondicion = 999, Observacion = "inválido" } },
        });

        Assert.IsType<BadRequestObjectResult>(resultado.Result);

        var historia = await db.HistoriasMedicas
            .Include(h => h.Condiciones)
            .SingleAsync(h => h.IdPaciente == paciente.IdPaciente);

        Assert.Equal("Estado inicial", historia.ObservacionesGenerales);
        var fila = Assert.Single(historia.Condiciones);
        Assert.Equal(3, fila.IdCondicion);
    }
}
