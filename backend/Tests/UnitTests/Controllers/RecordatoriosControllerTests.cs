using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Peredent.Api.Controllers;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Filters;
using Peredent.Api.Options;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Controllers;

public class RecordatoriosControllerTests
{
    private const string ApiKey = "clave-de-prueba-0123456789abcdef";

    // IRecordatorioService falso: devuelve el resumen indicado y registra con qué dryRun se llamó.
    private sealed class FakeRecordatorioService : IRecordatorioService
    {
        public RecordatorioResumenDto Resumen { get; set; } = new();

        public List<bool> LlamadasDryRun { get; } = new();

        public Task<RecordatorioResumenDto> EnviarRecordatoriosDeMananaAsync(bool dryRun, CancellationToken ct)
        {
            LlamadasDryRun.Add(dryRun);
            Resumen.DryRun = dryRun;
            return Task.FromResult(Resumen);
        }
    }

    // Ejecuta el filtro de API key como lo haría el pipeline de MVC y devuelve
    // el resultado que dejó (null = la solicitud pasa al controller).
    private static IActionResult? EjecutarFiltro(string? apiKeyConfigurada, string? headerRecibido)
    {
        var httpContext = new DefaultHttpContext();
        if (headerRecibido is not null)
        {
            httpContext.Request.Headers[ApiKeyRecordatoriosFilter.NombreHeader] = headerRecibido;
        }

        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
        var context = new AuthorizationFilterContext(actionContext, new List<IFilterMetadata>());
        var filtro = new ApiKeyRecordatoriosFilter(
            Microsoft.Extensions.Options.Options.Create(new RecordatoriosOptions { ApiKey = apiKeyConfigurada! }));

        filtro.OnAuthorization(context);
        return context.Result;
    }

    [Fact]
    public void Controller_TieneElFiltroDeApiKeyYNoUsaJwt()
    {
        var atributos = typeof(RecordatoriosController).GetCustomAttributes(inherit: true);

        Assert.Contains(atributos, a => a is RequiereApiKeyRecordatoriosAttribute);
        Assert.DoesNotContain(atributos, a => a is Microsoft.AspNetCore.Authorization.AuthorizeAttribute);
    }

    [Fact]
    public void SinHeader_Devuelve401SinCuerpo()
    {
        Assert.IsType<NoAutorizadoSinCuerpoResult>(EjecutarFiltro(ApiKey, headerRecibido: null));
    }

    [Theory]
    [InlineData("")]
    [InlineData("clave-de-prueba-0123456789abcdeX")] // misma longitud, último carácter distinto
    [InlineData("CLAVE-DE-PRUEBA-0123456789ABCDEF")] // distinta capitalización
    public void KeyIncorrecta_Devuelve401SinCuerpo(string headerRecibido)
    {
        Assert.IsType<NoAutorizadoSinCuerpoResult>(EjecutarFiltro(ApiKey, headerRecibido));
    }

    [Theory]
    [InlineData("clave")]
    [InlineData("clave-de-prueba-0123456789abcdef-y-algo-mas")]
    [InlineData("clave-de-prueba-0123456789abcde")] // un carácter menos
    public void KeyDeDistintaLongitud_Devuelve401(string headerRecibido)
    {
        Assert.IsType<NoAutorizadoSinCuerpoResult>(EjecutarFiltro(ApiKey, headerRecibido));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ApiKeyConfiguradaVacia_RechazaTodo(string? apiKeyConfigurada)
    {
        Assert.IsType<NoAutorizadoSinCuerpoResult>(EjecutarFiltro(apiKeyConfigurada, headerRecibido: ""));
        Assert.IsType<NoAutorizadoSinCuerpoResult>(EjecutarFiltro(apiKeyConfigurada, headerRecibido: "   "));
        Assert.IsType<NoAutorizadoSinCuerpoResult>(EjecutarFiltro(apiKeyConfigurada, headerRecibido: "cualquier-cosa"));
    }

    [Fact]
    public async Task ResultadoNoAutorizado_Escribe401ConCuerpoVacio()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Response.Body = new MemoryStream();
        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());

        await new NoAutorizadoSinCuerpoResult().ExecuteResultAsync(actionContext);

        Assert.Equal(StatusCodes.Status401Unauthorized, httpContext.Response.StatusCode);
        Assert.Equal(0, httpContext.Response.Body.Length);
        Assert.IsNotAssignableFrom<IClientErrorActionResult>(new NoAutorizadoSinCuerpoResult());
    }

    [Fact]
    public void KeyCorrecta_DejaPasarLaSolicitud()
    {
        Assert.Null(EjecutarFiltro(ApiKey, ApiKey));
    }

    [Fact]
    public async Task KeyCorrectaConDryRun_Devuelve200ConElResumenYPasaDryRunAlServicio()
    {
        Assert.Null(EjecutarFiltro(ApiKey, ApiKey));
        var servicio = new FakeRecordatorioService
        {
            Resumen = new RecordatorioResumenDto { FechaObjetivo = new DateOnly(2026, 9, 28), TotalEncontradas = 3, PorEnviar = 2, Omitidas = 1 },
        };

        var resultado = await new RecordatoriosController(servicio).Enviar(dryRun: true);

        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        var resumen = Assert.IsType<RecordatorioResumenDto>(ok.Value);
        Assert.True(resumen.DryRun);
        Assert.Equal(2, resumen.PorEnviar);
        Assert.Equal(new[] { true }, servicio.LlamadasDryRun);
    }

    [Fact]
    public async Task KeyCorrectaSinDryRun_Devuelve200AunqueHayaFallidas()
    {
        Assert.Null(EjecutarFiltro(ApiKey, ApiKey));
        var servicio = new FakeRecordatorioService
        {
            Resumen = new RecordatorioResumenDto { TotalEncontradas = 3, Enviadas = 2, Fallidas = 1 },
        };

        var resultado = await new RecordatoriosController(servicio).Enviar(dryRun: false);

        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        var resumen = Assert.IsType<RecordatorioResumenDto>(ok.Value);
        Assert.False(resumen.DryRun);
        Assert.Equal((2, 1), (resumen.Enviadas, resumen.Fallidas));
        Assert.Equal(new[] { false }, servicio.LlamadasDryRun);
    }

    [Fact]
    public async Task EjecucionEnCurso_Devuelve409ConMessage()
    {
        var servicio = new FakeRecordatorioService
        {
            Resumen = new RecordatorioResumenDto { EjecucionEnCurso = true },
        };

        var resultado = await new RecordatoriosController(servicio).Enviar(dryRun: false);

        var conflict = Assert.IsType<ConflictObjectResult>(resultado.Result);
        var message = conflict.Value!.GetType().GetProperty("message")!.GetValue(conflict.Value) as string;
        Assert.Contains("en curso", message);
    }
}
