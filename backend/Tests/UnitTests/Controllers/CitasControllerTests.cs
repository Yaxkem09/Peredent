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

public class CitasControllerTests
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
        db.EstadosCita.AddRange(
            new EstadoCita { IdEstadoCita = 1, TipoEstadoCita = "Pendiente" },
            new EstadoCita { IdEstadoCita = 2, TipoEstadoCita = "Confirmada" },
            new EstadoCita { IdEstadoCita = 3, TipoEstadoCita = "Atendida" },
            new EstadoCita { IdEstadoCita = 4, TipoEstadoCita = "Cancelada" },
            new EstadoCita { IdEstadoCita = 5, TipoEstadoCita = "No Asistio" });
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

    private static async Task<Usuario> CrearDentistaAsync(ApplicationDbContext db)
    {
        var usuario = new Usuario
        {
            NombreUsuario = "dra.solis",
            Salt = "salt",
            ContrasenaHash = "hash",
            IdRol = 1,
            Estado = true,
        };
        db.Usuarios.Add(usuario);
        await db.SaveChangesAsync();
        return usuario;
    }

    private static CreateCitaDto NuevaCitaDto(int idPaciente, int idUsuario, DateOnly fecha, TimeOnly hora, int duracionMinutos = 30) => new()
    {
        IdPaciente = idPaciente,
        IdUsuario = idUsuario,
        Fecha = fecha,
        Hora = hora,
        DuracionMinutos = duracionMinutos,
        TipoTratamiento = "Limpieza dental",
    };

    private static CitaDto ExtraerDto(ActionResult<CitaDto> resultado)
    {
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsType<CitaDto>(ok.Value);
    }

    [Fact]
    public async Task Create_DatosValidos_Devuelve201ConLaCitaEnPendiente()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var controller = new CitasController(new CitaService(db));

        var resultado = await controller.Create(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        var creado = Assert.IsType<CreatedAtActionResult>(resultado.Result);
        var dto = Assert.IsType<CitaDto>(creado.Value);
        Assert.Equal("Pendiente", dto.Estado);
    }

    [Fact]
    public async Task Create_ConflictoDeHorario_Devuelve400ConMensajeClaro()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var controller = new CitasController(new CitaService(db));

        await controller.Create(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        var resultado = await controller.Create(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 15)));

        var badRequest = Assert.IsType<BadRequestObjectResult>(resultado.Result);
        var mensaje = (string)badRequest.Value!.GetType().GetProperty("message")!.GetValue(badRequest.Value)!;
        Assert.Equal("Ese horario se cruza con otra cita.", mensaje);
    }

    [Fact]
    public async Task Create_CitaDeUnaHora_Devuelve201ConDuracion60()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var controller = new CitasController(new CitaService(db));

        var resultado = await controller.Create(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0), duracionMinutos: 60));

        var creado = Assert.IsType<CreatedAtActionResult>(resultado.Result);
        var dto = Assert.IsType<CitaDto>(creado.Value);
        Assert.Equal(60, dto.DuracionMinutos);
    }

    [Fact]
    public async Task Create_DuracionNoPermitida_Devuelve400()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var controller = new CitasController(new CitaService(db));

        var resultado = await controller.Create(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0), duracionMinutos: 45));

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Create_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var controller = new CitasController(new CitaService(db));

        var resultado = await controller.Create(
            NuevaCitaDto(999, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task GetById_Inexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = new CitasController(new CitaService(db));

        var resultado = await controller.GetById(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task GetByRango_DesdePosteriorAHasta_Devuelve400()
    {
        using var db = CrearContexto();
        var controller = new CitasController(new CitaService(db));

        var resultado = await controller.GetByRango(new DateOnly(2026, 9, 10), new DateOnly(2026, 9, 1));

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Update_ConflictoDeHorario_Devuelve400()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var controller = new CitasController(new CitaService(db));

        await controller.Create(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));
        var segunda = await controller.Create(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(10, 0)));
        var idSegunda = ((CitaDto)((CreatedAtActionResult)segunda.Result!).Value!).IdCita;

        var resultado = await controller.Update(idSegunda, new UpdateCitaDto
        {
            IdPaciente = paciente.IdPaciente,
            IdUsuario = dentista.IdUsuario,
            Fecha = new DateOnly(2026, 9, 1),
            Hora = new TimeOnly(9, 10),
            TipoTratamiento = "Limpieza dental",
            IdEstadoCita = 1,
        });

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Cancelar_SoftCancel_Devuelve200ConEstadoCancelada()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var controller = new CitasController(new CitaService(db));

        var creada = await controller.Create(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));
        var idCreada = ((CitaDto)((CreatedAtActionResult)creada.Result!).Value!).IdCita;

        var resultado = ExtraerDto(await controller.Cancelar(idCreada));

        Assert.Equal("Cancelada", resultado.Estado);
        Assert.Equal(1, await db.Citas.CountAsync());
    }

    [Fact]
    public async Task Cancelar_CitaInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var controller = new CitasController(new CitaService(db));

        var resultado = await controller.Cancelar(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }
}
