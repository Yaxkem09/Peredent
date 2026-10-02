using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Peredent.Api.Options;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Services;

public class WhatsAppServiceTests
{
    private const string Token = "token-de-prueba";

    // Handler falso: responde lo que indique la prueba y guarda la petición
    // (el cuerpo se lee aquí porque el servicio desecha el request al terminar).
    private sealed class FakeHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _responder;

        public FakeHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> responder)
        {
            _responder = responder;
        }

        public int Llamadas { get; private set; }

        public HttpRequestMessage? UltimaPeticion { get; private set; }

        public string? UltimoCuerpo { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Llamadas++;
            UltimaPeticion = request;
            UltimoCuerpo = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return await _responder(request, cancellationToken);
        }

        public static FakeHttpMessageHandler Responde(HttpStatusCode status, string json) =>
            new((_, _) => Task.FromResult(new HttpResponseMessage(status)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }));
    }

    private static WhatsAppOptions OpcionesValidas(bool enabled = true) => new()
    {
        Enabled = enabled,
        ApiVersion = "v25.0",
        PhoneNumberId = "1234567890",
        AccessToken = Token,
        TemplateName = "recordatorio_cita",
        TemplateLanguage = "es",
    };

    private static WhatsAppService CrearServicio(FakeHttpMessageHandler handler, WhatsAppOptions? opciones = null)
    {
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://graph.facebook.com/") };
        return new WhatsAppService(
            httpClient,
            Microsoft.Extensions.Options.Options.Create(opciones ?? OpcionesValidas()),
            NullLogger<WhatsAppService>.Instance);
    }

    private static Task<WhatsAppEnvioResultado> Enviar(WhatsAppService servicio, CancellationToken ct = default) =>
        servicio.EnviarRecordatorioCitaAsync("50251234567", "Juan Pérez", "lunes 28 de septiembre", "10:00 AM", ct);

    [Fact]
    public async Task Envio_Exitoso_ExtraeElMessageId()
    {
        var handler = FakeHttpMessageHandler.Responde(HttpStatusCode.OK,
            """{"messaging_product":"whatsapp","contacts":[{"input":"50251234567","wa_id":"50251234567"}],"messages":[{"id":"wamid.PRUEBA0000000001"}]}""");

        var resultado = await Enviar(CrearServicio(handler));

        Assert.True(resultado.Exitoso);
        Assert.Equal("wamid.PRUEBA0000000001", resultado.MessageId);
        Assert.Null(resultado.Error);
    }

    [Fact]
    public async Task Envio_ArmaUrlHeaderYCuerpoCorrectos()
    {
        var handler = FakeHttpMessageHandler.Responde(HttpStatusCode.OK, """{"messages":[{"id":"wamid.1"}]}""");

        await Enviar(CrearServicio(handler));

        var peticion = Assert.IsType<HttpRequestMessage>(handler.UltimaPeticion);
        Assert.Equal(HttpMethod.Post, peticion.Method);
        Assert.Equal("https://graph.facebook.com/v25.0/1234567890/messages", peticion.RequestUri!.ToString());
        Assert.Equal("Bearer", peticion.Headers.Authorization!.Scheme);
        Assert.Equal(Token, peticion.Headers.Authorization.Parameter);

        using var json = JsonDocument.Parse(handler.UltimoCuerpo!);
        var raiz = json.RootElement;
        Assert.Equal("whatsapp", raiz.GetProperty("messaging_product").GetString());
        Assert.Equal("50251234567", raiz.GetProperty("to").GetString());
        Assert.Equal("template", raiz.GetProperty("type").GetString());

        var template = raiz.GetProperty("template");
        Assert.Equal("recordatorio_cita", template.GetProperty("name").GetString());
        Assert.Equal("es", template.GetProperty("language").GetProperty("code").GetString());

        var componente = Assert.Single(template.GetProperty("components").EnumerateArray());
        Assert.Equal("body", componente.GetProperty("type").GetString());

        var parametros = componente.GetProperty("parameters").EnumerateArray().ToList();
        Assert.Equal(3, parametros.Count);
        Assert.All(parametros, p => Assert.Equal("text", p.GetProperty("type").GetString()));
        Assert.Equal(
            new[] { "Juan Pérez", "lunes 28 de septiembre", "10:00 AM" },
            parametros.Select(p => p.GetProperty("text").GetString()));
    }

    [Fact]
    public async Task Error400DeMeta_DevuelveMensajeYCodigoSinLanzar()
    {
        var handler = FakeHttpMessageHandler.Responde(HttpStatusCode.BadRequest,
            """{"error":{"message":"(#132001) Template name does not exist in the translation","type":"OAuthException","code":132001,"fbtrace_id":"Abc"}}""");

        var resultado = await Enviar(CrearServicio(handler));

        Assert.False(resultado.Exitoso);
        Assert.Null(resultado.MessageId);
        Assert.Contains("400", resultado.Error);
        Assert.Contains("Template name does not exist", resultado.Error);
        Assert.Contains("132001", resultado.Error);
    }

    [Fact]
    public async Task Error401TokenInvalido_DevuelveFalloConCodigo190()
    {
        var handler = FakeHttpMessageHandler.Responde(HttpStatusCode.Unauthorized,
            """{"error":{"message":"Error validating access token: Session has expired","type":"OAuthException","code":190,"error_subcode":463}}""");

        var resultado = await Enviar(CrearServicio(handler));

        Assert.False(resultado.Exitoso);
        Assert.Contains("401", resultado.Error);
        Assert.Contains("Session has expired", resultado.Error);
        Assert.Contains("190", resultado.Error);
        Assert.DoesNotContain(Token, resultado.Error);
    }

    [Fact]
    public async Task ErrorSinCuerpoJson_DevuelveFalloGenerico()
    {
        var handler = new FakeHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway)
        {
            Content = new StringContent("<html>Bad Gateway</html>", Encoding.UTF8, "text/html"),
        }));

        var resultado = await Enviar(CrearServicio(handler));

        Assert.False(resultado.Exitoso);
        Assert.Contains("502", resultado.Error);
    }

    [Fact]
    public async Task Timeout_DevuelveFalloSinLanzar()
    {
        // Así se ve un timeout de HttpClient: TaskCanceledException sin que el ct del llamador se haya cancelado.
        var handler = new FakeHttpMessageHandler((_, _) =>
            throw new TaskCanceledException("timeout", new TimeoutException()));

        var resultado = await Enviar(CrearServicio(handler));

        Assert.False(resultado.Exitoso);
        Assert.Contains("Timeout", resultado.Error);
    }

    [Fact]
    public async Task ErrorDeRed_DevuelveFalloSinLanzar()
    {
        var handler = new FakeHttpMessageHandler((_, _) =>
            throw new HttpRequestException("No such host is known."));

        var resultado = await Enviar(CrearServicio(handler));

        Assert.False(resultado.Exitoso);
        Assert.Contains("No such host is known.", resultado.Error);
    }

    [Fact]
    public async Task CancelacionDelLlamador_SePropaga()
    {
        using var cts = new CancellationTokenSource();
        var handler = new FakeHttpMessageHandler((_, ct) =>
        {
            cts.Cancel();
            ct.ThrowIfCancellationRequested();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Enviar(CrearServicio(handler), cts.Token));
    }

    [Fact]
    public async Task Deshabilitado_NoLlamaAMetaYDevuelveFallo()
    {
        var handler = FakeHttpMessageHandler.Responde(HttpStatusCode.OK, """{"messages":[{"id":"wamid.1"}]}""");

        var resultado = await Enviar(CrearServicio(handler, OpcionesValidas(enabled: false)));

        Assert.False(resultado.Exitoso);
        Assert.Contains("deshabilitado", resultado.Error);
        Assert.Equal(0, handler.Llamadas);
    }
}
