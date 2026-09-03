using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.Models;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Services;

public class CitaServiceTests
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

    private static async Task<Usuario> CrearDentistaAsync(ApplicationDbContext db, string nombreUsuario = "dra.solis")
    {
        var usuario = new Usuario
        {
            NombreUsuario = nombreUsuario,
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
    };

    [Fact]
    public async Task CrearAsync_DatosValidos_NaceEnPendiente()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        Assert.True(resultado.Exitoso);
        Assert.Equal("Pendiente", resultado.Cita!.Estado);
        Assert.Equal(30, resultado.Cita.DuracionMinutos);
    }

    [Fact]
    public async Task CrearAsync_PacienteInexistente_DevuelvePacienteNoEncontrado()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var resultado = await service.CrearAsync(
            NuevaCitaDto(999, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.PacienteNoEncontrado, resultado.Error);
    }

    [Fact]
    public async Task CrearAsync_DentistaInexistente_DevuelveDentistaNoEncontrado()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var service = new CitaService(db);

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, 999, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.DentistaNoEncontrado, resultado.Error);
    }

    [Theory]
    [InlineData(6, 30)]
    [InlineData(18, 45)]
    [InlineData(19, 0)]
    public async Task CrearAsync_FueraDelHorarioDeAtencion_DevuelveFueraDeHorario(int hora, int minuto)
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(hora, minuto)));

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.FueraDeHorarioAtencion, resultado.Error);
    }

    [Fact]
    public async Task CrearAsync_MenosDe30MinutosDeOtraCitaDelMismoDentista_DevuelveConflictoHorario()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 15)));

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.ConflictoHorario, resultado.Error);
        Assert.Equal("Ese horario se cruza con otra cita.", resultado.Mensaje);
    }

    [Fact]
    public async Task CrearAsync_Exactamente30MinutosDeDiferencia_NoEsConflicto()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 30)));

        Assert.True(resultado.Exitoso);
    }

    [Fact]
    public async Task CrearAsync_MismaHoraOtroDentista_NoEsConflicto()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista1 = await CrearDentistaAsync(db, "dra.solis");
        var dentista2 = await CrearDentistaAsync(db, "dr.ramirez");
        var service = new CitaService(db);

        await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista1.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista2.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        Assert.True(resultado.Exitoso);
    }

    [Fact]
    public async Task CrearAsync_CitaCancelada_LiberaElHorario()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var primera = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));
        await service.CancelarAsync(primera.Cita!.IdCita);

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        Assert.True(resultado.Exitoso);
    }

    [Theory]
    [InlineData(45)]
    [InlineData(15)]
    [InlineData(0)]
    public async Task CrearAsync_DuracionNoPermitida_DevuelveDuracionInvalida(int duracionMinutos)
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0), duracionMinutos));

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.DuracionInvalida, resultado.Error);
    }

    [Fact]
    public async Task CrearAsync_CitaDeUnaHora_SeCreaConDuracion60()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0), duracionMinutos: 60));

        Assert.True(resultado.Exitoso);
        Assert.Equal(60, resultado.Cita!.DuracionMinutos);
    }

    [Fact]
    public async Task CrearAsync_CitaDeUnaHoraQueTerminaJustoALasSieteDeLaNoche_EsValida()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(18, 0), duracionMinutos: 60));

        Assert.True(resultado.Exitoso);
    }

    [Fact]
    public async Task CrearAsync_CitaDeUnaHoraQueSePasaDelCierre_DevuelveFueraDeHorario()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(18, 30), duracionMinutos: 60));

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.FueraDeHorarioAtencion, resultado.Error);
    }

    [Fact]
    public async Task CrearAsync_CitaDe30MinutosQueEmpiezaDentroDeUnaCitaDeUnaHoraDelMismoDentista_DevuelveConflictoHorario()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        // 9:00-10:00 (una hora).
        await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0), duracionMinutos: 60));

        // 9:45-10:15: arranca antes de que termine la primera.
        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 45), duracionMinutos: 30));

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.ConflictoHorario, resultado.Error);
    }

    [Fact]
    public async Task CrearAsync_CitaDe30MinutosJustoDespuesDeUnaCitaDeUnaHora_NoEsConflicto()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        // 9:00-10:00 (una hora).
        await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0), duracionMinutos: 60));

        // 10:00-10:30: arranca justo cuando termina la primera.
        var resultado = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(10, 0), duracionMinutos: 30));

        Assert.True(resultado.Exitoso);
    }

    [Fact]
    public async Task ActualizarAsync_ExcluyeLaPropiaCitaDelChequeoDeConflicto()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var creada = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        var idEstadoConfirmada = (await db.EstadosCita.SingleAsync(e => e.TipoEstadoCita == "Confirmada")).IdEstadoCita;

        // Misma fecha/hora que ya tenía: no debería chocar consigo misma.
        var resultado = await service.ActualizarAsync(creada.Cita!.IdCita, new UpdateCitaDto
        {
            IdPaciente = paciente.IdPaciente,
            IdUsuario = dentista.IdUsuario,
            Fecha = new DateOnly(2026, 9, 1),
            Hora = new TimeOnly(9, 0),
            IdEstadoCita = idEstadoConfirmada,
        });

        Assert.True(resultado.Exitoso);
        Assert.Equal("Confirmada", resultado.Cita!.Estado);
    }

    [Fact]
    public async Task ActualizarAsync_MoverAUnHorarioOcupadoPorOtraCita_DevuelveConflictoHorario()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));
        var segunda = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(10, 0)));

        var resultado = await service.ActualizarAsync(segunda.Cita!.IdCita, new UpdateCitaDto
        {
            IdPaciente = paciente.IdPaciente,
            IdUsuario = dentista.IdUsuario,
            Fecha = new DateOnly(2026, 9, 1),
            Hora = new TimeOnly(9, 10),
            IdEstadoCita = 1,
        });

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.ConflictoHorario, resultado.Error);
    }

    [Fact]
    public async Task ActualizarAsync_AlargarA60MinutosChocaConLaSiguienteCita_DevuelveConflictoHorario()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var primera = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0), duracionMinutos: 30));
        await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 30), duracionMinutos: 30));

        // Alargar la primera cita a 1 hora la haría chocar con la segunda (9:30-10:00).
        var resultado = await service.ActualizarAsync(primera.Cita!.IdCita, new UpdateCitaDto
        {
            IdPaciente = paciente.IdPaciente,
            IdUsuario = dentista.IdUsuario,
            Fecha = new DateOnly(2026, 9, 1),
            Hora = new TimeOnly(9, 0),
            DuracionMinutos = 60,
            IdEstadoCita = 1,
        });

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.ConflictoHorario, resultado.Error);
    }

    [Fact]
    public async Task ActualizarAsync_CitaInexistente_DevuelveCitaNoEncontrada()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var resultado = await service.ActualizarAsync(999, new UpdateCitaDto
        {
            IdPaciente = paciente.IdPaciente,
            IdUsuario = dentista.IdUsuario,
            Fecha = new DateOnly(2026, 9, 1),
            Hora = new TimeOnly(9, 0),
            IdEstadoCita = 1,
        });

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.CitaNoEncontrada, resultado.Error);
    }

    [Fact]
    public async Task CancelarAsync_CambiaEstadoYConservaElRegistro()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        var creada = await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));

        var resultado = await service.CancelarAsync(creada.Cita!.IdCita);

        Assert.True(resultado.Exitoso);
        Assert.Equal("Cancelada", resultado.Cita!.Estado);
        Assert.Equal(1, await db.Citas.CountAsync());
    }

    [Fact]
    public async Task CancelarAsync_CitaInexistente_DevuelveCitaNoEncontrada()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var service = new CitaService(db);

        var resultado = await service.CancelarAsync(999);

        Assert.False(resultado.Exitoso);
        Assert.Equal(CitaError.CitaNoEncontrada, resultado.Error);
    }

    [Fact]
    public async Task GetByRangoAsync_DevuelveSoloCitasDentroDelRango()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var paciente = await CrearPacienteAsync(db);
        var dentista = await CrearDentistaAsync(db);
        var service = new CitaService(db);

        await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 1), new TimeOnly(9, 0)));
        await service.CrearAsync(
            NuevaCitaDto(paciente.IdPaciente, dentista.IdUsuario, new DateOnly(2026, 9, 10), new TimeOnly(9, 0)));

        var enRango = await service.GetByRangoAsync(new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 5));

        var unica = Assert.Single(enRango);
        Assert.Equal(new DateOnly(2026, 9, 1), unica.Fecha);
    }

    [Fact]
    public async Task GetByIdAsync_IdInexistente_DevuelveNull()
    {
        using var db = CrearContexto();
        var service = new CitaService(db);

        var resultado = await service.GetByIdAsync(999);

        Assert.Null(resultado);
    }
}
