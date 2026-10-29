using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.Helpers;
using Peredent.Api.Models;
using Peredent.Api.Options;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Services;

public class WhatsAppWebhookServiceTests
{
    private const int IdPendiente = 1;
    private const int IdConfirmada = 2;
    private const int IdAtendida = 3;
    private const int IdCancelada = 4;
    private const int IdNoAsistio = 5;

    private const string TelefonoPaciente = "50251234567";
    private const string WamidRecordatorio = "wamid.RECORDATORIO1";

    private static string Confirmar => RespuestaRecordatorioWhatsApp.BotonConfirmar;
    private static string Modificar => RespuestaRecordatorioWhatsApp.BotonModificar;

    // IWhatsAppService falso: registra los textos enviados; puede fallar o lanzar.
    private sealed class FakeWhatsAppService : IWhatsAppService
    {
        public List<(string Telefono, string Texto)> Textos { get; } = new();

        public WhatsAppEnvioResultado Resultado { get; set; } = WhatsAppEnvioResultado.Ok("wamid.VUELTA");

        public Exception? Lanzar { get; set; }

        public Task<WhatsAppEnvioResultado> EnviarRecordatorioCitaAsync(
            string telefono, string nombrePaciente, string fecha, string hora, CancellationToken ct) =>
            throw new InvalidOperationException("El webhook no debería enviar recordatorios.");

        public Task<WhatsAppEnvioResultado> EnviarTextoAsync(string telefono, string texto, CancellationToken ct)
        {
            Textos.Add((telefono, texto));
            return Lanzar is null ? Task.FromResult(Resultado) : Task.FromException<WhatsAppEnvioResultado>(Lanzar);
        }
    }

    private static readonly ClinicaOptions ClinicaPorDefecto = new();

    private static string Mensaje(string plantilla, ClinicaOptions? clinica = null) =>
        RespuestaRecordatorioWhatsApp.Formatear(plantilla, clinica ?? ClinicaPorDefecto);

    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static async Task<Cita> SembrarCitaAsync(
        ApplicationDbContext db, int idEstado = IdPendiente, DateTime? fechaInicio = null, string? recordatorioId = WamidRecordatorio)
    {
        db.EstadosCita.AddRange(
            new EstadoCita { IdEstadoCita = IdPendiente, TipoEstadoCita = "Pendiente" },
            new EstadoCita { IdEstadoCita = IdConfirmada, TipoEstadoCita = "Confirmada" },
            new EstadoCita { IdEstadoCita = IdAtendida, TipoEstadoCita = "Atendida" },
            new EstadoCita { IdEstadoCita = IdCancelada, TipoEstadoCita = "Cancelada" },
            new EstadoCita { IdEstadoCita = IdNoAsistio, TipoEstadoCita = "No Asistio" });

        var paciente = new Paciente
        {
            Nombres = "Juan",
            Apellidos = "Pérez",
            FechaNacimiento = new DateTime(1990, 1, 1),
            Telefono = "5123-4567",
            AceptaRecordatoriosWhatsApp = true,
            FechaRegistro = DateTime.UtcNow,
        };
        db.Pacientes.Add(paciente);
        await db.SaveChangesAsync();

        var inicio = fechaInicio ?? FechaHoraGuatemala.Ahora().Date.AddDays(1).AddHours(10);
        var cita = new Cita
        {
            IdPaciente = paciente.IdPaciente,
            IdUsuario = 1,
            IdEstadoCita = idEstado,
            FechaInicio = inicio,
            FechaFin = inicio.AddMinutes(30),
            RecordatorioEnviadoEn = FechaHoraGuatemala.Ahora().AddHours(-2),
            RecordatorioMessageId = recordatorioId,
        };
        db.Citas.Add(cita);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return cita;
    }

    // Notificación con un toque a un botón de respuesta rápida de la plantilla.
    // Segundos Unix (como texto, igual que Meta) de hace `hace`.
    private static string TimestampDeHace(TimeSpan hace) =>
        DateTimeOffset.UtcNow.Subtract(hace).ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);

    // Por defecto el paciente toca el botón "ahora"; `hace` simula una respuesta
    // que Meta entrega tarde y `timestamp` permite un valor crudo (ausente o ilegible).
    private static WhatsAppWebhookPayload Boton(
        string texto, string? contextoId = WamidRecordatorio, string id = "wamid.RESPUESTA1", string? payload = null,
        TimeSpan? hace = null, bool timestampCrudo = false, string? timestamp = null) =>
        ConMensajes(new WhatsAppWebhookMessage
        {
            From = TelefonoPaciente,
            Id = id,
            Timestamp = timestampCrudo ? timestamp : TimestampDeHace(hace ?? TimeSpan.Zero),
            Type = "button",
            Context = contextoId is null ? null : new WhatsAppWebhookContext { From = "15550000000", Id = contextoId },
            Button = new WhatsAppWebhookButton { Text = texto, Payload = payload ?? texto },
        });

    private static WhatsAppWebhookPayload ConMensajes(params WhatsAppWebhookMessage[] mensajes)
    {
        var value = new WhatsAppWebhookValue { MessagingProduct = "whatsapp" };
        value.Messages.AddRange(mensajes);
        return ConValue(value);
    }

    private static WhatsAppWebhookPayload ConValue(WhatsAppWebhookValue value)
    {
        var change = new WhatsAppWebhookChange { Field = "messages", Value = value };
        var entry = new WhatsAppWebhookEntry { Id = "100000000000001" };
        entry.Changes.Add(change);
        var payload = new WhatsAppWebhookPayload { Object = "whatsapp_business_account" };
        payload.Entry.Add(entry);
        return payload;
    }

    private static WhatsAppWebhookService CrearServicio(
        ApplicationDbContext db, IWhatsAppService whatsApp, ClinicaOptions? clinica = null, ILogger<WhatsAppWebhookService>? logger = null) =>
        new(db, whatsApp, Microsoft.Extensions.Options.Options.Create(clinica ?? new ClinicaOptions()),
            logger ?? NullLogger<WhatsAppWebhookService>.Instance);

    private static Task Procesar(ApplicationDbContext db, IWhatsAppService whatsApp, WhatsAppWebhookPayload payload, ClinicaOptions? clinica = null) =>
        CrearServicio(db, whatsApp, clinica).ProcesarAsync(payload, CancellationToken.None);

    // Relee la cita desde la "base" (sin lo que haya en el change tracker).
    private static Cita Releer(ApplicationDbContext db, int idCita)
    {
        db.ChangeTracker.Clear();
        return db.Citas.Single(c => c.IdCita == idCita);
    }

    private static void AssertSinRespuesta(Cita cita)
    {
        Assert.Null(cita.RespuestaPaciente);
        Assert.Null(cita.RespuestaPacienteEn);
        Assert.Null(cita.RespuestaMessageId);
    }

    // ---------- b. Confirmar ----------

    [Fact]
    public async Task Confirmar_CitaPendiente_PasaAConfirmadaRegistraYResponde()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();
        var antes = FechaHoraGuatemala.Ahora();

        await Procesar(db, whatsApp, Boton(Confirmar));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdConfirmada, guardada.IdEstadoCita);
        Assert.Equal("Confirmo", guardada.RespuestaPaciente);
        Assert.Equal("wamid.RESPUESTA1", guardada.RespuestaMessageId);
        Assert.InRange(guardada.RespuestaPacienteEn!.Value, antes.AddSeconds(-1), FechaHoraGuatemala.Ahora().AddSeconds(1));
        Assert.Equal((TelefonoPaciente, Mensaje(RespuestaRecordatorioWhatsApp.MensajeConfirmado)), Assert.Single(whatsApp.Textos));
    }

    [Fact]
    public async Task Confirmar_CitaYaConfirmada_NoCambiaElEstadoPeroRegistraYResponde()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdConfirmada);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Confirmar));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdConfirmada, guardada.IdEstadoCita);
        Assert.Equal("Confirmo", guardada.RespuestaPaciente);
        Assert.Equal(Mensaje(RespuestaRecordatorioWhatsApp.MensajeConfirmado), Assert.Single(whatsApp.Textos).Texto);
    }

    [Fact]
    public async Task Confirmar_CitaCancelada_NoLaReactivaNoRegistraYRespondeCancelada()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdCancelada);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Confirmar));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdCancelada, guardada.IdEstadoCita);
        AssertSinRespuesta(guardada);
        var texto = Assert.Single(whatsApp.Textos).Texto;
        Assert.Equal(Mensaje(RespuestaRecordatorioWhatsApp.MensajeCitaCancelada), texto);
        Assert.Contains("7755-1080", texto);
    }

    // ---------- c. Modificar ----------

    [Theory]
    [InlineData(IdPendiente)]
    [InlineData(IdConfirmada)]
    public async Task Modificar_NoCambiaElEstadoRegistraYRespondeConTelefonoYHorario(int idEstado)
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, idEstado);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Modificar));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(idEstado, guardada.IdEstadoCita);
        Assert.Equal("Modificar", guardada.RespuestaPaciente);
        Assert.Equal("wamid.RESPUESTA1", guardada.RespuestaMessageId);
        Assert.NotNull(guardada.RespuestaPacienteEn);

        var texto = Assert.Single(whatsApp.Textos).Texto;
        Assert.Equal(
            "Para modificar su cita, llámenos al 7755-1080.\n\n*Horario de atención:*\n"
            + "Lunes a viernes: 8:00 AM a 1:00 PM y 2:00 PM a 6:00 PM\nSábados: 8:00 AM a 1:00 PM",
            texto);
    }

    [Fact]
    public async Task Modificar_UsaTelefonoYHorarioConfigurados()
    {
        using var db = CrearContexto();
        await SembrarCitaAsync(db);
        var whatsApp = new FakeWhatsAppService();
        var clinica = new ClinicaOptions { Telefono = "2222-3333", Horario = "Lunes a sábado: 9:00 AM a 5:00 PM" };

        await Procesar(db, whatsApp, Boton(Modificar), clinica);

        Assert.Equal(
            "Para modificar su cita, llámenos al 2222-3333.\n\n*Horario de atención:*\nLunes a sábado: 9:00 AM a 5:00 PM",
            Assert.Single(whatsApp.Textos).Texto);
    }

    [Fact]
    public async Task Modificar_CitaCancelada_RegistraLaSolicitudSinReactivar()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdCancelada);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Modificar));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdCancelada, guardada.IdEstadoCita);
        Assert.Equal("Modificar", guardada.RespuestaPaciente);
        Assert.Equal(Mensaje(RespuestaRecordatorioWhatsApp.MensajeModificar), Assert.Single(whatsApp.Textos).Texto);
    }

    // ---------- a. Cita pasada ----------

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task CitaQueYaEmpezo_Reciente_NoCambiaNadaNiResponde(bool confirmar)
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente, fechaInicio: FechaHoraGuatemala.Ahora().AddMinutes(-5));
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(confirmar ? Confirmar : Modificar));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdPendiente, guardada.IdEstadoCita);
        AssertSinRespuesta(guardada);
        Assert.Empty(whatsApp.Textos);
    }

    [Theory]
    [InlineData(IdAtendida)]
    [InlineData(IdNoAsistio)]
    public async Task CitaAtendidaONoAsistio_SeTrataComoPasadaSinMensaje(int idEstado)
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, idEstado);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Confirmar));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(idEstado, guardada.IdEstadoCita);
        AssertSinRespuesta(guardada);
        Assert.Empty(whatsApp.Textos);
    }

    // ---------- Cambio de respuesta y duplicados ----------

    [Fact]
    public async Task CambioDeRespuesta_PrimeroModificarDespuesConfirmar_GanaLaUltima()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Modificar, id: "wamid.R1"));
        var trasModificar = Releer(db, cita.IdCita);
        Assert.Equal(IdPendiente, trasModificar.IdEstadoCita);
        Assert.Equal("Modificar", trasModificar.RespuestaPaciente);

        await Procesar(db, whatsApp, Boton(Confirmar, id: "wamid.R2"));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdConfirmada, guardada.IdEstadoCita);
        Assert.Equal("Confirmo", guardada.RespuestaPaciente);
        Assert.Equal("wamid.R2", guardada.RespuestaMessageId);
        Assert.Equal(
            new[] { Mensaje(RespuestaRecordatorioWhatsApp.MensajeModificar), Mensaje(RespuestaRecordatorioWhatsApp.MensajeConfirmado) },
            whatsApp.Textos.Select(t => t.Texto));
    }

    [Fact]
    public async Task CambioDeRespuesta_ConfirmarDespuesModificar_MantieneConfirmadaYGuardaModificar()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Confirmar, id: "wamid.R1"));
        await Procesar(db, whatsApp, Boton(Modificar, id: "wamid.R2"));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdConfirmada, guardada.IdEstadoCita); // Modificar no cambia el estado
        Assert.Equal("Modificar", guardada.RespuestaPaciente);
        Assert.Equal("wamid.R2", guardada.RespuestaMessageId);
    }

    [Fact]
    public async Task WebhookDuplicado_NoSeProcesaNiSeRespondeDosVeces()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Confirmar));
        var primera = Releer(db, cita.IdCita).RespuestaPacienteEn;

        await Procesar(db, whatsApp, Boton(Confirmar));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(primera, guardada.RespuestaPacienteEn);
        Assert.Single(whatsApp.Textos);
    }

    // ---------- Mensajes que se ignoran ----------

    [Theory]
    [InlineData("wamid.DESCONOCIDO")]
    [InlineData(null)]
    public async Task ContextoDesconocidoOAusente_SeIgnora(string? contextoId)
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Confirmar, contextoId: contextoId));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdPendiente, guardada.IdEstadoCita);
        AssertSinRespuesta(guardada);
        Assert.Empty(whatsApp.Textos);
    }

    [Fact]
    public async Task BotonDesconocido_SeIgnora()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton("Cancelar mi cita"));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdPendiente, guardada.IdEstadoCita);
        AssertSinRespuesta(guardada);
        Assert.Empty(whatsApp.Textos);
    }

    [Fact]
    public async Task OtrosTiposDeMensajeYStatuses_SeIgnoran()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();
        var value = new WhatsAppWebhookValue();
        value.Messages.Add(new WhatsAppWebhookMessage
        {
            From = TelefonoPaciente, Id = "wamid.T1", Type = "text",
            // Aunque responda al recordatorio, texto escrito no se interpreta.
            Context = new WhatsAppWebhookContext { Id = WamidRecordatorio },
        });
        value.Messages.Add(new WhatsAppWebhookMessage { From = TelefonoPaciente, Id = "wamid.I1", Type = "image" });
        value.Statuses.Add(new WhatsAppWebhookStatus { Id = WamidRecordatorio, Status = "read", RecipientId = TelefonoPaciente });

        await Procesar(db, whatsApp, ConValue(value));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdPendiente, guardada.IdEstadoCita);
        AssertSinRespuesta(guardada);
        Assert.Empty(whatsApp.Textos);
    }

    [Fact]
    public async Task UnMensajeIgnoradoNoImpideProcesarLosDemas()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();
        var desconocido = Boton(Confirmar, contextoId: "wamid.OTRO", id: "wamid.X").Entry[0].Changes[0].Value!.Messages[0];
        var valido = Boton(Confirmar, id: "wamid.Y").Entry[0].Changes[0].Value!.Messages[0];

        await Procesar(db, whatsApp, ConMensajes(desconocido, valido));

        Assert.Equal(IdConfirmada, Releer(db, cita.IdCita).IdEstadoCita);
        Assert.Single(whatsApp.Textos);
    }

    // ---------- Fallo al responder ----------

    [Fact]
    public async Task FalloAlEnviarLaRespuesta_NoRevierteElCambioDeLaCita()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService { Resultado = WhatsAppEnvioResultado.Fallo("Meta respondió HTTP 400: (código 131047)") };

        await Procesar(db, whatsApp, Boton(Confirmar));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdConfirmada, guardada.IdEstadoCita);
        Assert.Equal("Confirmo", guardada.RespuestaPaciente);
        Assert.Single(whatsApp.Textos);
    }

    [Fact]
    public async Task ExcepcionAlEnviarLaRespuesta_NoRevierteNiPropaga()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService { Lanzar = new InvalidOperationException("fallo inesperado") };

        await Procesar(db, whatsApp, Boton(Modificar));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal("Modificar", guardada.RespuestaPaciente);
        Assert.Equal(IdPendiente, guardada.IdEstadoCita);
    }

    // ---------- Logs ----------

    [Fact]
    public async Task Logs_NuncaIncluyenWamidCompletosNiElTelefono()
    {
        using var db = CrearContexto();
        await SembrarCitaAsync(db, IdPendiente, recordatorioId: WamidsDePrueba.Recordatorio);
        var whatsApp = new FakeWhatsAppService();
        var logger = new LoggerCapturado<WhatsAppWebhookService>();
        var servicio = CrearServicio(db, whatsApp, logger: logger);
        var ct = CancellationToken.None;

        // Recorre los 4 logs que llevan un wamid:
        // 1. contexto desconocido (no hay cita con ese recordatorio)
        await servicio.ProcesarAsync(Boton(Confirmar, contextoId: WamidsDePrueba.Desconocido, id: "wamid.OTRO1234567"), ct);
        // 2. respuesta válida y su duplicado
        await servicio.ProcesarAsync(Boton(Confirmar, contextoId: WamidsDePrueba.Recordatorio, id: WamidsDePrueba.Respuesta), ct);
        await servicio.ProcesarAsync(Boton(Confirmar, contextoId: WamidsDePrueba.Recordatorio, id: WamidsDePrueba.Respuesta), ct);
        // 3. status (log Debug)
        var value = new WhatsAppWebhookValue();
        value.Statuses.Add(new WhatsAppWebhookStatus { Id = WamidsDePrueba.Recordatorio, Status = "read", RecipientId = TelefonoPaciente });
        await servicio.ProcesarAsync(ConValue(value), ct);
        // 4. error al procesar un mensaje (falla el envío de la respuesta)
        whatsApp.Lanzar = new InvalidOperationException("fallo de prueba");
        await servicio.ProcesarAsync(Boton(Modificar, contextoId: WamidsDePrueba.Recordatorio, id: WamidsDePrueba.Desconocido), ct);

        var texto = logger.TodoElTexto;
        Assert.Contains("no hay cita", texto);
        Assert.Contains("webhook duplicado", texto);
        Assert.Contains("estado read", texto);
        Assert.Contains("Error al procesar", texto);
        Assert.Contains(WamidWhatsApp.Enmascarar(WamidsDePrueba.Respuesta), texto);

        foreach (var wamid in new[] { WamidsDePrueba.Recordatorio, WamidsDePrueba.Respuesta, WamidsDePrueba.Desconocido })
        {
            Assert.DoesNotContain(wamid, texto);
        }

        Assert.DoesNotContain(WamidsDePrueba.TelefonoBase64, texto);
        Assert.DoesNotContain(TelefonoPaciente, texto);

        // La base sigue guardando los wamid completos (la última respuesta, el
        // "Modificar" del paso 4, se guardó antes de que fallara el envío).
        db.ChangeTracker.Clear();
        var cita = await db.Citas.SingleAsync();
        Assert.Equal(WamidsDePrueba.Recordatorio, cita.RecordatorioMessageId);
        Assert.Equal(WamidsDePrueba.Desconocido, cita.RespuestaMessageId);
    }

    // ---------- Respuestas tardías (Meta reintenta después de una caída) ----------

    [Fact]
    public async Task RespuestaReciente_AplicaLasReglasYRespondeAlPaciente()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Confirmar, hace: TimeSpan.FromMinutes(5)));

        Assert.Equal(IdConfirmada, Releer(db, cita.IdCita).IdEstadoCita);
        Assert.Equal(Mensaje(RespuestaRecordatorioWhatsApp.MensajeConfirmado), Assert.Single(whatsApp.Textos).Texto);
    }

    [Fact]
    public async Task RespuestaJustoDentroDelLimite_TodaviaResponde()
    {
        using var db = CrearContexto();
        await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Confirmar, hace: RespuestaRecordatorioWhatsApp.AntiguedadMaximaParaResponder - TimeSpan.FromMinutes(1)));

        Assert.Single(whatsApp.Textos);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task RespuestaDeHaceDosHoras_AplicaLasReglasPeroNoResponde(bool confirmar)
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();
        var logger = new LoggerCapturado<WhatsAppWebhookService>();

        await CrearServicio(db, whatsApp, logger: logger)
            .ProcesarAsync(Boton(confirmar ? Confirmar : Modificar, hace: TimeSpan.FromHours(2)), CancellationToken.None);

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(confirmar ? IdConfirmada : IdPendiente, guardada.IdEstadoCita);
        Assert.Equal(confirmar ? "Confirmo" : "Modificar", guardada.RespuestaPaciente);
        Assert.Equal("wamid.RESPUESTA1", guardada.RespuestaMessageId);
        Assert.Empty(whatsApp.Textos);
        Assert.Contains("Respuesta tardía", logger.TodoElTexto);
        Assert.Contains("sin mensaje de vuelta", logger.TodoElTexto);
    }

    [Fact]
    public async Task RespuestaTardiaSobreCitaPasada_NoCambiaNadaNiResponde()
    {
        using var db = CrearContexto();
        // El caso del bug: el botón se tocó antes de la cita, pero llegó días después.
        var cita = await SembrarCitaAsync(db, IdPendiente, fechaInicio: FechaHoraGuatemala.Ahora().AddDays(-2));
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Confirmar, hace: TimeSpan.FromDays(3)));

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdPendiente, guardada.IdEstadoCita);
        AssertSinRespuesta(guardada);
        Assert.Empty(whatsApp.Textos);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("no-es-un-numero")]
    [InlineData("-60")]
    [InlineData("99999999999999999999")]
    public async Task TimestampAusenteOIlegible_SeComportaComoHoy(string? timestamp)
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();

        await Procesar(db, whatsApp, Boton(Confirmar, timestampCrudo: true, timestamp: timestamp));

        Assert.Equal(IdConfirmada, Releer(db, cita.IdCita).IdEstadoCita);
        Assert.Equal(Mensaje(RespuestaRecordatorioWhatsApp.MensajeConfirmado), Assert.Single(whatsApp.Textos).Texto);
    }

    // ---------- Cita pasada: sin mensaje, reciente o tardía ----------

    [Theory]
    [InlineData(0)]    // reciente
    [InlineData(180)]  // tardía (3 h)
    public async Task CitaPasada_NoCambiaNadaNiEnviaMensaje_RecienteOTardia(int minutosDeAntiguedad)
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdConfirmada, fechaInicio: FechaHoraGuatemala.Ahora().AddHours(-1));
        var whatsApp = new FakeWhatsAppService();
        var logger = new LoggerCapturado<WhatsAppWebhookService>();

        await CrearServicio(db, whatsApp, logger: logger)
            .ProcesarAsync(Boton(Modificar, hace: TimeSpan.FromMinutes(minutosDeAntiguedad)), CancellationToken.None);

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdConfirmada, guardada.IdEstadoCita);
        AssertSinRespuesta(guardada);
        Assert.Empty(whatsApp.Textos);
        Assert.Contains("la cita ya empezó o pasó", logger.TodoElTexto);
    }

    // ---------- Orden de llegada ----------

    [Fact]
    public async Task RespuestaViejaQueLlegaDespuesDeUnaMasReciente_SeIgnora()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();
        var logger = new LoggerCapturado<WhatsAppWebhookService>();
        var servicio = CrearServicio(db, whatsApp, logger: logger);

        // El paciente tocó "Modificar" hace 20 min y "Sí asistiré" hace 5 min,
        // pero Meta entrega primero la más reciente y después la vieja.
        await servicio.ProcesarAsync(Boton(Confirmar, id: "wamid.NUEVA", hace: TimeSpan.FromMinutes(5)), CancellationToken.None);
        await servicio.ProcesarAsync(Boton(Modificar, id: "wamid.VIEJA", hace: TimeSpan.FromMinutes(20)), CancellationToken.None);

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(IdConfirmada, guardada.IdEstadoCita);
        Assert.Equal("Confirmo", guardada.RespuestaPaciente);
        Assert.Equal("wamid.NUEVA", guardada.RespuestaMessageId);
        Assert.Equal(Mensaje(RespuestaRecordatorioWhatsApp.MensajeConfirmado), Assert.Single(whatsApp.Textos).Texto);
        Assert.Contains("es anterior a la respuesta ya registrada", logger.TodoElTexto);
    }

    [Fact]
    public async Task RespuestaMasRecienteQueLaRegistrada_SiReemplaza()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();
        var servicio = CrearServicio(db, whatsApp);

        await servicio.ProcesarAsync(Boton(Confirmar, id: "wamid.A", hace: TimeSpan.FromMinutes(20)), CancellationToken.None);
        await servicio.ProcesarAsync(Boton(Modificar, id: "wamid.B", hace: TimeSpan.FromMinutes(5)), CancellationToken.None);

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal("Modificar", guardada.RespuestaPaciente);
        Assert.Equal("wamid.B", guardada.RespuestaMessageId);
        Assert.Equal(2, whatsApp.Textos.Count);
    }

    [Fact]
    public async Task OrdenDeLlegada_SinTimestampValido_SeProcesaComoHoy()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var whatsApp = new FakeWhatsAppService();
        var servicio = CrearServicio(db, whatsApp);

        await servicio.ProcesarAsync(Boton(Confirmar, id: "wamid.A", hace: TimeSpan.FromMinutes(5)), CancellationToken.None);
        // Sin timestamp no se puede saber si es más vieja: gana, como antes, la última que llega.
        await servicio.ProcesarAsync(Boton(Modificar, id: "wamid.B", timestampCrudo: true, timestamp: null), CancellationToken.None);

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal("Modificar", guardada.RespuestaPaciente);
        Assert.Equal("wamid.B", guardada.RespuestaMessageId);
    }

    // ---------- RespuestaPacienteEn ----------

    [Fact]
    public async Task RespuestaPacienteEn_GuardaLaHoraDelToqueEnHoraDeGuatemala()
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var payload = Boton(Confirmar, hace: TimeSpan.FromMinutes(30));
        var timestamp = payload.Entry[0].Changes[0].Value!.Messages[0].Timestamp!;
        var esperada = FechaHoraGuatemala.DesdeUtc(DateTimeOffset.FromUnixTimeSeconds(long.Parse(timestamp)));

        await Procesar(db, new FakeWhatsAppService(), payload);

        var guardada = Releer(db, cita.IdCita);
        Assert.Equal(esperada, guardada.RespuestaPacienteEn);
        Assert.InRange(FechaHoraGuatemala.Ahora() - guardada.RespuestaPacienteEn!.Value, TimeSpan.FromMinutes(29), TimeSpan.FromMinutes(31));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("no-es-un-numero")]
    public async Task RespuestaPacienteEn_SinTimestampValido_UsaLaHoraDeProcesamiento(string? timestamp)
    {
        using var db = CrearContexto();
        var cita = await SembrarCitaAsync(db, IdPendiente);
        var antes = FechaHoraGuatemala.Ahora();

        await Procesar(db, new FakeWhatsAppService(), Boton(Confirmar, timestampCrudo: true, timestamp: timestamp));

        Assert.InRange(Releer(db, cita.IdCita).RespuestaPacienteEn!.Value, antes.AddSeconds(-1), FechaHoraGuatemala.Ahora().AddSeconds(1));
    }
}
