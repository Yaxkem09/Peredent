using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Helpers;
using Peredent.Api.Models;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Services;

public class RecordatorioServiceTests
{
    private const int IdPendiente = 1;
    private const int IdConfirmada = 2;
    private const int IdAtendida = 3;
    private const int IdCancelada = 4;
    private const int IdNoAsistio = 5;

    // IWhatsAppService falso: registra cada llamada y responde según Responder
    // (por defecto, éxito con un wamid derivado del teléfono).
    private sealed class FakeWhatsAppService : IWhatsAppService
    {
        public List<(string Telefono, string Nombre, string Fecha, string Hora)> Llamadas { get; } = new();

        public Func<string, Task<WhatsAppEnvioResultado>> Responder { get; set; } =
            telefono => Task.FromResult(WhatsAppEnvioResultado.Ok($"wamid.{telefono}"));

        public Task<WhatsAppEnvioResultado> EnviarRecordatorioCitaAsync(
            string telefono, string nombrePaciente, string fecha, string hora, CancellationToken ct)
        {
            lock (Llamadas)
            {
                Llamadas.Add((telefono, nombrePaciente, fecha, hora));
            }

            return Responder(telefono);
        }
    }

    private static DateTime Manana => FechaHoraGuatemala.Ahora().Date.AddDays(1);

    private static ApplicationDbContext CrearContexto(string? nombreDb = null)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(nombreDb ?? Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static async Task SembrarEstadosAsync(ApplicationDbContext db)
    {
        db.EstadosCita.AddRange(
            new EstadoCita { IdEstadoCita = IdPendiente, TipoEstadoCita = "Pendiente" },
            new EstadoCita { IdEstadoCita = IdConfirmada, TipoEstadoCita = "Confirmada" },
            new EstadoCita { IdEstadoCita = IdAtendida, TipoEstadoCita = "Atendida" },
            new EstadoCita { IdEstadoCita = IdCancelada, TipoEstadoCita = "Cancelada" },
            new EstadoCita { IdEstadoCita = IdNoAsistio, TipoEstadoCita = "No Asistio" });
        await db.SaveChangesAsync();
    }

    private static async Task<Cita> CrearCitaAsync(
        ApplicationDbContext db,
        DateTime fechaInicio,
        int idEstado = IdPendiente,
        string telefono = "5123-4567",
        bool acepta = true,
        string nombres = "Juan",
        string apellidos = "Pérez")
    {
        var paciente = new Paciente
        {
            Nombres = nombres,
            Apellidos = apellidos,
            FechaNacimiento = new DateTime(1990, 1, 1),
            Telefono = telefono,
            AceptaRecordatoriosWhatsApp = acepta,
            FechaRegistro = DateTime.UtcNow,
        };
        db.Pacientes.Add(paciente);
        await db.SaveChangesAsync();

        var cita = new Cita
        {
            IdPaciente = paciente.IdPaciente,
            IdUsuario = 1,
            IdEstadoCita = idEstado,
            FechaInicio = fechaInicio,
            FechaFin = fechaInicio.AddMinutes(30),
        };
        db.Citas.Add(cita);
        await db.SaveChangesAsync();
        return cita;
    }

    private static RecordatorioService CrearServicio(ApplicationDbContext db, IWhatsAppService whatsApp) =>
        new(db, whatsApp, NullLogger<RecordatorioService>.Instance);

    private static Task<RecordatorioResumenDto> Ejecutar(ApplicationDbContext db, IWhatsAppService whatsApp, bool dryRun = false) =>
        CrearServicio(db, whatsApp).EnviarRecordatoriosDeMananaAsync(dryRun, CancellationToken.None);

    [Fact]
    public async Task SoloTomaCitasDeManana_IncluyendoLas0000YLas2359()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var hoy = await CrearCitaAsync(db, Manana.AddDays(-1).AddHours(10), telefono: "11111111");
        var ultimoMinutoDeHoy = await CrearCitaAsync(db, Manana.AddMinutes(-1), telefono: "22222222");
        var primeraDeManana = await CrearCitaAsync(db, Manana, telefono: "33333333");
        var ultimaDeManana = await CrearCitaAsync(db, Manana.AddHours(23).AddMinutes(59), telefono: "44444444");
        var pasadoManana = await CrearCitaAsync(db, Manana.AddDays(1), telefono: "55555555");
        var whatsApp = new FakeWhatsAppService();

        var resumen = await Ejecutar(db, whatsApp);

        Assert.Equal(DateOnly.FromDateTime(Manana), resumen.FechaObjetivo);
        Assert.Equal(2, resumen.TotalEncontradas);
        Assert.Equal(2, resumen.Enviadas);
        Assert.Equal(new[] { primeraDeManana.IdCita, ultimaDeManana.IdCita }, resumen.Detalle.Select(d => d.IdCita));
        Assert.Equal(new[] { "50233333333", "50244444444" }, whatsApp.Llamadas.Select(l => l.Telefono));
        Assert.Null(db.Citas.Single(c => c.IdCita == hoy.IdCita).RecordatorioEnviadoEn);
        Assert.Null(db.Citas.Single(c => c.IdCita == ultimoMinutoDeHoy.IdCita).RecordatorioEnviadoEn);
        Assert.Null(db.Citas.Single(c => c.IdCita == pasadoManana.IdCita).RecordatorioEnviadoEn);
    }

    [Fact]
    public async Task SoloTomaCitasPendientesYConfirmadas()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var pendiente = await CrearCitaAsync(db, Manana.AddHours(9), IdPendiente);
        var confirmada = await CrearCitaAsync(db, Manana.AddHours(10), IdConfirmada);
        await CrearCitaAsync(db, Manana.AddHours(11), IdAtendida);
        await CrearCitaAsync(db, Manana.AddHours(12), IdCancelada);
        await CrearCitaAsync(db, Manana.AddHours(13), IdNoAsistio);
        var whatsApp = new FakeWhatsAppService();

        var resumen = await Ejecutar(db, whatsApp);

        Assert.Equal(2, resumen.TotalEncontradas);
        Assert.Equal(new[] { pendiente.IdCita, confirmada.IdCita }, resumen.Detalle.Select(d => d.IdCita));
        Assert.Equal(2, whatsApp.Llamadas.Count);
    }

    [Fact]
    public async Task OmiteSinConsentimientoYTelefonoInvalido_ConSuMotivo()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var sinConsentimiento = await CrearCitaAsync(db, Manana.AddHours(9), acepta: false, telefono: "51234567");
        var telefonoInvalido = await CrearCitaAsync(db, Manana.AddHours(10), telefono: "123-45");
        var valida = await CrearCitaAsync(db, Manana.AddHours(11), telefono: "5555-1234");
        var whatsApp = new FakeWhatsAppService();

        var resumen = await Ejecutar(db, whatsApp);

        Assert.Equal(3, resumen.TotalEncontradas);
        Assert.Equal(2, resumen.Omitidas);
        Assert.Equal(1, resumen.Enviadas);

        var detalleSinConsentimiento = resumen.Detalle.Single(d => d.IdCita == sinConsentimiento.IdCita);
        Assert.Equal(RecordatorioResultados.Omitido, detalleSinConsentimiento.Resultado);
        Assert.Equal("sin consentimiento", detalleSinConsentimiento.Motivo);

        var detalleInvalido = resumen.Detalle.Single(d => d.IdCita == telefonoInvalido.IdCita);
        Assert.Equal(RecordatorioResultados.Omitido, detalleInvalido.Resultado);
        Assert.Equal("teléfono inválido", detalleInvalido.Motivo);

        Assert.Equal("50255551234", Assert.Single(whatsApp.Llamadas).Telefono);
        Assert.NotNull(db.Citas.Single(c => c.IdCita == valida.IdCita).RecordatorioEnviadoEn);
        Assert.Null(db.Citas.Single(c => c.IdCita == sinConsentimiento.IdCita).RecordatorioEnviadoEn);
        Assert.Null(db.Citas.Single(c => c.IdCita == telefonoInvalido.IdCita).RecordatorioEnviadoEn);
    }

    [Fact]
    public async Task EnviaNombreFechaYHoraConElFormatoDeLaPlantilla()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        await CrearCitaAsync(db, Manana.AddHours(9), nombres: "  María José ", apellidos: "González López");
        await CrearCitaAsync(db, Manana.AddHours(15).AddMinutes(30), nombres: "Pedro", apellidos: "Ramírez");
        var whatsApp = new FakeWhatsAppService();

        await Ejecutar(db, whatsApp);

        var fechaEsperada = PlantillaRecordatorio.Fecha(Manana);
        Assert.Matches(@"^[a-záéíóúñ]+ \d{1,2} de [a-z]+$", fechaEsperada);
        Assert.Collection(whatsApp.Llamadas,
            l => Assert.Equal(("María González", fechaEsperada, "9:00 AM"), (l.Nombre, l.Fecha, l.Hora)),
            l => Assert.Equal(("Pedro Ramírez", fechaEsperada, "3:30 PM"), (l.Nombre, l.Fecha, l.Hora)));
    }

    [Fact]
    public async Task DetalleNuncaIncluyeElTelefonoCompleto()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        await CrearCitaAsync(db, Manana.AddHours(9), telefono: "5123-4567");

        var resumen = await Ejecutar(db, new FakeWhatsAppService());

        var detalle = Assert.Single(resumen.Detalle);
        Assert.Equal("****4567", detalle.TelefonoEnmascarado);
        Assert.DoesNotContain("5123", detalle.TelefonoEnmascarado);
    }

    [Fact]
    public async Task DryRun_NoLlamaAWhatsAppNiModificaLaBase()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        await CrearCitaAsync(db, Manana.AddHours(9));
        await CrearCitaAsync(db, Manana.AddHours(10), acepta: false);
        var whatsApp = new FakeWhatsAppService();

        var resumen = await Ejecutar(db, whatsApp, dryRun: true);

        Assert.True(resumen.DryRun);
        Assert.Equal(2, resumen.TotalEncontradas);
        Assert.Equal(1, resumen.PorEnviar);
        Assert.Equal(1, resumen.Omitidas);
        Assert.Equal(0, resumen.Enviadas);
        Assert.Contains(resumen.Detalle, d => d.Resultado == RecordatorioResultados.PorEnviar);
        Assert.Empty(whatsApp.Llamadas);

        db.ChangeTracker.Clear();
        Assert.All(db.Citas, c =>
        {
            Assert.Null(c.RecordatorioEnviadoEn);
            Assert.Null(c.RecordatorioMessageId);
            Assert.Null(c.RecordatorioError);
        });
    }

    [Fact]
    public async Task FalloParcial_LasDemasSeEnvianYLaFallidaGuardaElErrorTruncado()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        var primera = await CrearCitaAsync(db, Manana.AddHours(9), telefono: "11111111");
        var fallida = await CrearCitaAsync(db, Manana.AddHours(10), telefono: "22222222");
        var conExcepcion = await CrearCitaAsync(db, Manana.AddHours(11), telefono: "33333333");
        var ultima = await CrearCitaAsync(db, Manana.AddHours(12), telefono: "44444444");
        var errorLargo = "Meta respondió HTTP 400: " + new string('x', 600);
        var whatsApp = new FakeWhatsAppService
        {
            Responder = telefono => telefono switch
            {
                "50222222222" => Task.FromResult(WhatsAppEnvioResultado.Fallo(errorLargo)),
                "50233333333" => throw new InvalidOperationException("algo inesperado"),
                _ => Task.FromResult(WhatsAppEnvioResultado.Ok($"wamid.{telefono}")),
            },
        };

        var resumen = await Ejecutar(db, whatsApp);

        Assert.Equal(2, resumen.Enviadas);
        Assert.Equal(2, resumen.Fallidas);
        Assert.Equal(4, whatsApp.Llamadas.Count);

        db.ChangeTracker.Clear();
        var citaFallida = db.Citas.Single(c => c.IdCita == fallida.IdCita);
        Assert.Null(citaFallida.RecordatorioEnviadoEn);
        Assert.Equal(500, citaFallida.RecordatorioError!.Length);
        Assert.StartsWith("Meta respondió HTTP 400", citaFallida.RecordatorioError);

        var citaConExcepcion = db.Citas.Single(c => c.IdCita == conExcepcion.IdCita);
        Assert.Null(citaConExcepcion.RecordatorioEnviadoEn);
        Assert.Contains("algo inesperado", citaConExcepcion.RecordatorioError);

        foreach (var enviada in new[] { primera, ultima })
        {
            var cita = db.Citas.Single(c => c.IdCita == enviada.IdCita);
            Assert.NotNull(cita.RecordatorioEnviadoEn);
            Assert.StartsWith("wamid.", cita.RecordatorioMessageId);
            Assert.Null(cita.RecordatorioError);
        }
    }

    [Fact]
    public async Task SegundaEjecucion_NoReenviaLasYaEnviadasPeroReintentaLasFallidas()
    {
        using var db = CrearContexto();
        await SembrarEstadosAsync(db);
        await CrearCitaAsync(db, Manana.AddHours(9), telefono: "11111111");
        var fallida = await CrearCitaAsync(db, Manana.AddHours(10), telefono: "22222222");
        var whatsApp = new FakeWhatsAppService
        {
            Responder = telefono => Task.FromResult(telefono == "50222222222"
                ? WhatsAppEnvioResultado.Fallo("error temporal")
                : WhatsAppEnvioResultado.Ok("wamid.1")),
        };

        var primera = await Ejecutar(db, whatsApp);
        whatsApp.Responder = _ => Task.FromResult(WhatsAppEnvioResultado.Ok("wamid.2"));
        var segunda = await Ejecutar(db, whatsApp);
        var tercera = await Ejecutar(db, whatsApp);

        Assert.Equal((1, 1), (primera.Enviadas, primera.Fallidas));
        Assert.Equal(1, segunda.TotalEncontradas);
        Assert.Equal(fallida.IdCita, Assert.Single(segunda.Detalle).IdCita);
        Assert.Equal(1, segunda.Enviadas);
        Assert.Equal(0, tercera.TotalEncontradas);
        Assert.Equal(3, whatsApp.Llamadas.Count);
        Assert.Null(db.Citas.Single(c => c.IdCita == fallida.IdCita).RecordatorioError);
    }

    [Fact]
    public async Task EjecucionSimultanea_LaSegundaDevuelveEnCursoSinEnviar()
    {
        var nombreDb = Guid.NewGuid().ToString();
        using (var semilla = CrearContexto(nombreDb))
        {
            await SembrarEstadosAsync(semilla);
            await CrearCitaAsync(semilla, Manana.AddHours(9));
        }

        var envioIniciado = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var liberarEnvio = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var whatsApp = new FakeWhatsAppService
        {
            Responder = async _ =>
            {
                envioIniciado.TrySetResult();
                await liberarEnvio.Task;
                return WhatsAppEnvioResultado.Ok("wamid.1");
            },
        };

        using var dbPrimera = CrearContexto(nombreDb);
        using var dbSegunda = CrearContexto(nombreDb);
        using var dbDryRun = CrearContexto(nombreDb);
        var primeraTask = Ejecutar(dbPrimera, whatsApp);

        try
        {
            await envioIniciado.Task.WaitAsync(TimeSpan.FromSeconds(10));

            var segunda = await Ejecutar(dbSegunda, whatsApp);
            var dryRun = await Ejecutar(dbDryRun, whatsApp, dryRun: true);

            Assert.True(segunda.EjecucionEnCurso);
            Assert.Equal(0, segunda.TotalEncontradas);
            Assert.Empty(segunda.Detalle);
            Assert.Single(whatsApp.Llamadas);

            // El dryRun no usa el candado: responde aunque haya un envío en curso.
            Assert.False(dryRun.EjecucionEnCurso);
            Assert.Equal(1, dryRun.PorEnviar);
        }
        finally
        {
            liberarEnvio.TrySetResult();
        }

        var primera = await primeraTask;
        Assert.False(primera.EjecucionEnCurso);
        Assert.Equal(1, primera.Enviadas);
        Assert.Single(whatsApp.Llamadas);
    }
}
