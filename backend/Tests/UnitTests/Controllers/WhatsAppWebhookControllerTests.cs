using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Peredent.Api.Controllers;
using Peredent.Api.DTOs.Request;
using Peredent.Api.Options;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Controllers;

public class WhatsAppWebhookControllerTests
{
    private const string VerifyToken = "verify-token-de-prueba";
    private const string AppSecret = "app-secret-de-prueba-0123456789";

    // IWhatsAppWebhookService falso: registra los payloads recibidos y puede lanzar.
    private sealed class FakeWebhookService : IWhatsAppWebhookService
    {
        public ConcurrentQueue<WhatsAppWebhookPayload> Recibidos { get; } = new();

        public Exception? Lanzar { get; set; }

        public Task ProcesarAsync(WhatsAppWebhookPayload payload, CancellationToken ct)
        {
            Recibidos.Enqueue(payload);
            return Lanzar is null ? Task.CompletedTask : Task.FromException(Lanzar);
        }
    }

    // Logger que guarda todo lo registrado, para verificar qué NO aparece.
    private sealed class CapturaLogs : ILoggerProvider
    {
        public ConcurrentQueue<(LogLevel Nivel, string Texto)> Entradas { get; } = new();

        public ILogger CreateLogger(string categoryName) => new Logger(this);

        public void Dispose()
        {
        }

        public string TodoElTexto => string.Join('\n', Entradas.Select(e => e.Texto));

        private sealed class Logger(CapturaLogs captura) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
                captura.Entradas.Enqueue((logLevel, $"{formatter(state, exception)} {exception}"));
        }
    }

    private static string Firmar(byte[] cuerpo, string secreto) =>
        "sha256=" + Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secreto), cuerpo)).ToLowerInvariant();

    // Servidor real (Kestrel en un puerto libre) con este controller y el
    // pipeline completo de MVC: filtro de firma, buffering y [FromBody].
    private sealed class Servidor : IAsyncDisposable
    {
        private readonly WebApplication _app;

        private Servidor(WebApplication app, HttpClient cliente)
        {
            _app = app;
            Cliente = cliente;
        }

        public HttpClient Cliente { get; }

        public static async Task<Servidor> IniciarAsync(string appSecret, FakeWebhookService servicio, CapturaLogs logs)
        {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
            builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Logging.ClearProviders();
            builder.Logging.AddProvider(logs);
            builder.Logging.SetMinimumLevel(LogLevel.Trace);
            // Igual que appsettings.json (Production): el log de peticiones de
            // ASP.NET Core ("Request starting ...?hub.verify_token=...") incluye
            // la query string y solo sale con Microsoft.AspNetCore en Information
            // (appsettings.Development.json).
            builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
            builder.Services.AddControllers().AddApplicationPart(typeof(WhatsAppWebhookController).Assembly);
            builder.Services.Configure<WhatsAppOptions>(o =>
            {
                o.AppSecret = appSecret;
                o.WebhookVerifyToken = VerifyToken;
            });
            builder.Services.AddSingleton<IWhatsAppWebhookService>(servicio);

            var app = builder.Build();
            app.MapControllers();
            await app.StartAsync();

            var cliente = new HttpClient { BaseAddress = new Uri(app.Urls.First()) };
            return new Servidor(app, cliente);
        }

        public Task<HttpResponseMessage> PostAsync(byte[] cuerpo, string? firma)
        {
            var contenido = new ByteArrayContent(cuerpo);
            contenido.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            var request = new HttpRequestMessage(HttpMethod.Post, "api/whatsapp/webhook") { Content = contenido };
            if (firma is not null)
            {
                request.Headers.TryAddWithoutValidation("X-Hub-Signature-256", firma);
            }

            return Cliente.SendAsync(request);
        }

        public async ValueTask DisposeAsync()
        {
            Cliente.Dispose();
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
    }

    private static byte[] Bytes(string json) => Encoding.UTF8.GetBytes(json);

    // ---------- GET: verificación del webhook ----------

    private static WhatsAppWebhookController CrearController(string verifyToken = VerifyToken) =>
        new(
            Microsoft.Extensions.Options.Options.Create(new WhatsAppOptions { WebhookVerifyToken = verifyToken }),
            new FakeWebhookService(),
            NullLogger<WhatsAppWebhookController>.Instance);

    [Fact]
    public void Get_TokenCorrecto_DevuelveElChallengeEnTextoPlano()
    {
        var resultado = CrearController().Verificar("subscribe", VerifyToken, "1158201444");

        var contenido = Assert.IsType<ContentResult>(resultado);
        Assert.Equal("1158201444", contenido.Content);
        Assert.Equal("text/plain", contenido.ContentType);
        Assert.Null(contenido.StatusCode); // 200
    }

    [Theory]
    [InlineData("otro-token")]
    [InlineData("verify-token-de-prueba ")]
    [InlineData("")]
    [InlineData(null)]
    public void Get_TokenIncorrecto_Devuelve403(string? token)
    {
        var resultado = CrearController().Verificar("subscribe", token, "1158201444");

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsAssignableFrom<IStatusCodeActionResult>(resultado).StatusCode);
    }

    [Theory]
    [InlineData("unsubscribe")]
    [InlineData("SUBSCRIBE")]
    [InlineData("")]
    [InlineData(null)]
    public void Get_ModoDistintoDeSubscribe_Devuelve403(string? modo)
    {
        var resultado = CrearController().Verificar(modo, VerifyToken, "1158201444");

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsAssignableFrom<IStatusCodeActionResult>(resultado).StatusCode);
    }

    [Fact]
    public void Get_VerifyTokenNoConfigurado_RechazaTodo()
    {
        var resultado = CrearController(verifyToken: "").Verificar("subscribe", "", "1158201444");

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsAssignableFrom<IStatusCodeActionResult>(resultado).StatusCode);
    }

    // ---------- POST: notificaciones firmadas ----------

    [Fact]
    public async Task Post_FirmaValida_Devuelve200YPasaElPayloadDeserializadoAlServicio()
    {
        var servicio = new FakeWebhookService();
        await using var servidor = await Servidor.IniciarAsync(AppSecret, servicio, new CapturaLogs());
        var cuerpo = Bytes(WhatsAppWebhookEjemplos.BotonRespuestaRapida);

        var respuesta = await servidor.PostAsync(cuerpo, Firmar(cuerpo, AppSecret));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var payload = Assert.Single(servicio.Recibidos);
        var mensaje = Assert.Single(Assert.Single(Assert.Single(payload.Entry).Changes).Value!.Messages);
        Assert.Equal("button", mensaje.Type);
        Assert.Equal("Sí asistiré", mensaje.Button!.Text);
        Assert.Equal(WhatsAppWebhookEjemplos.WamidRecordatorio, mensaje.Context!.Id);
    }

    [Fact]
    public async Task Post_FirmaValidaConEstados_PasaLosEstadosAlServicio()
    {
        var servicio = new FakeWebhookService();
        await using var servidor = await Servidor.IniciarAsync(AppSecret, servicio, new CapturaLogs());
        var cuerpo = Bytes(WhatsAppWebhookEjemplos.Estados);

        var respuesta = await servidor.PostAsync(cuerpo, Firmar(cuerpo, AppSecret));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var value = Assert.Single(Assert.Single(Assert.Single(servicio.Recibidos).Entry).Changes).Value!;
        Assert.Equal(new[] { "delivered", "failed" }, value.Statuses.Select(s => s.Status));
    }

    [Fact]
    public async Task Post_FirmaConSecretoIncorrecto_Devuelve401SinCuerpoYNoLlamaAlServicio()
    {
        var servicio = new FakeWebhookService();
        await using var servidor = await Servidor.IniciarAsync(AppSecret, servicio, new CapturaLogs());
        var cuerpo = Bytes(WhatsAppWebhookEjemplos.BotonRespuestaRapida);

        var respuesta = await servidor.PostAsync(cuerpo, Firmar(cuerpo, "otro-secreto"));

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
        Assert.Empty(await respuesta.Content.ReadAsByteArrayAsync());
        Assert.Empty(servicio.Recibidos);
    }

    [Fact]
    public async Task Post_CuerpoModificadoDespuesDeFirmar_Devuelve401()
    {
        var servicio = new FakeWebhookService();
        await using var servidor = await Servidor.IniciarAsync(AppSecret, servicio, new CapturaLogs());
        var original = Bytes(WhatsAppWebhookEjemplos.BotonRespuestaRapida);
        var modificado = Bytes(WhatsAppWebhookEjemplos.BotonRespuestaRapida.Replace("Sí asistiré", "Modificar mi cita"));

        var respuesta = await servidor.PostAsync(modificado, Firmar(original, AppSecret));

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
        Assert.Empty(servicio.Recibidos);
    }

    [Theory]
    [InlineData(null)]                    // header ausente
    [InlineData("")]
    [InlineData("sha256=")]
    [InlineData("sha256=no-es-hex")]
    [InlineData("sha1=0123456789abcdef")] // otro algoritmo
    [InlineData("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")] // sin prefijo
    public async Task Post_FirmaFaltanteOMalFormada_Devuelve401YNoLlamaAlServicio(string? firma)
    {
        var servicio = new FakeWebhookService();
        await using var servidor = await Servidor.IniciarAsync(AppSecret, servicio, new CapturaLogs());

        var respuesta = await servidor.PostAsync(Bytes(WhatsAppWebhookEjemplos.BotonRespuestaRapida), firma);

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
        Assert.Empty(servicio.Recibidos);
    }

    [Fact]
    public async Task Post_AppSecretNoConfigurado_RechazaTodoYLoRegistraComoError()
    {
        var servicio = new FakeWebhookService();
        var logs = new CapturaLogs();
        await using var servidor = await Servidor.IniciarAsync(appSecret: "", servicio, logs);
        var cuerpo = Bytes(WhatsAppWebhookEjemplos.BotonRespuestaRapida);

        // Incluso firmado con un secreto vacío: sin App Secret configurado no se acepta nada.
        var respuesta = await servidor.PostAsync(cuerpo, Firmar(cuerpo, ""));

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
        Assert.Empty(servicio.Recibidos);
        Assert.Contains(logs.Entradas, e => e.Nivel == LogLevel.Error && e.Texto.Contains("WHATSAPP_APP_SECRET"));
    }

    [Fact]
    public async Task Post_ElServicioLanza_Devuelve200YRegistraElError()
    {
        var servicio = new FakeWebhookService { Lanzar = new InvalidOperationException("fallo de prueba") };
        var logs = new CapturaLogs();
        await using var servidor = await Servidor.IniciarAsync(AppSecret, servicio, logs);
        var cuerpo = Bytes(WhatsAppWebhookEjemplos.BotonRespuestaRapida);

        var respuesta = await servidor.PostAsync(cuerpo, Firmar(cuerpo, AppSecret));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.Single(servicio.Recibidos);
        Assert.Contains(logs.Entradas, e => e.Nivel == LogLevel.Error && e.Texto.Contains("fallo de prueba"));
    }

    [Fact]
    public async Task Logs_NuncaIncluyenSecretoFirmaNiTelefonoCompleto()
    {
        var logs = new CapturaLogs();
        var servicio = new FakeWebhookService();
        await using var servidor = await Servidor.IniciarAsync(AppSecret, servicio, logs);
        var cuerpo = Bytes(WhatsAppWebhookEjemplos.BotonRespuestaRapida);
        var firmaValida = Firmar(cuerpo, AppSecret);
        var firmaInvalida = Firmar(cuerpo, "otro-secreto");

        await servidor.PostAsync(cuerpo, firmaValida);
        await servidor.PostAsync(cuerpo, firmaInvalida);
        await servidor.Cliente.GetAsync($"api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token={VerifyToken}&hub.challenge=123");
        await servidor.Cliente.GetAsync("api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=token-incorrecto&hub.challenge=123");

        var texto = logs.TodoElTexto;
        Assert.Contains("rechazado", texto); // se registró algo de lo que pasó
        Assert.DoesNotContain(AppSecret, texto);
        Assert.DoesNotContain(VerifyToken, texto);
        Assert.DoesNotContain("token-incorrecto", texto);
        Assert.DoesNotContain(firmaValida["sha256=".Length..], texto);
        Assert.DoesNotContain(firmaInvalida["sha256=".Length..], texto);
        Assert.DoesNotContain(WhatsAppWebhookEjemplos.TelefonoPaciente, texto);
    }
}
