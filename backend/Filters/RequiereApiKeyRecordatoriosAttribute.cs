using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using Peredent.Api.Options;

namespace Peredent.Api.Filters;

// Protege endpoints que llama un proceso automático (el cron de GitHub
// Actions), no un usuario con JWT: exige el header X-Api-Key igual a
// REMINDERS_API_KEY. TypeFilterAttribute para que el filtro reciba
// IOptions<RecordatoriosOptions> por inyección de dependencias.
public class RequiereApiKeyRecordatoriosAttribute : TypeFilterAttribute
{
    public RequiereApiKeyRecordatoriosAttribute() : base(typeof(ApiKeyRecordatoriosFilter))
    {
    }
}

public class ApiKeyRecordatoriosFilter : IAuthorizationFilter
{
    public const string NombreHeader = "X-Api-Key";

    private readonly string _apiKeyConfigurada;

    public ApiKeyRecordatoriosFilter(IOptions<RecordatoriosOptions> opciones)
    {
        _apiKeyConfigurada = opciones.Value.ApiKey;
    }

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        // 401 sin cuerpo: no se indica si faltó el header, si la key es
        // incorrecta o si el servidor no tiene una configurada.
        if (!EsValida(context.HttpContext.Request.Headers[NombreHeader].ToString()))
        {
            context.Result = new NoAutorizadoSinCuerpoResult();
        }
    }

    private bool EsValida(string apiKeyRecibida)
    {
        // Sin REMINDERS_API_KEY configurada se rechaza todo (nunca "key vacía = abierto").
        if (string.IsNullOrWhiteSpace(_apiKeyConfigurada) || string.IsNullOrEmpty(apiKeyRecibida))
        {
            return false;
        }

        // FixedTimeEquals devuelve false de inmediato si las longitudes
        // difieren, lo que filtraría la longitud de la key. Comparando los
        // SHA-256 (siempre 32 bytes) la comparación es de tiempo constante.
        var hashRecibido = SHA256.HashData(Encoding.UTF8.GetBytes(apiKeyRecibida));
        var hashConfigurado = SHA256.HashData(Encoding.UTF8.GetBytes(_apiKeyConfigurada));

        return CryptographicOperations.FixedTimeEquals(hashRecibido, hashConfigurado);
    }
}

// 401 con cuerpo vacío. No se usa UnauthorizedResult porque, con
// [ApiController], ese resultado se convierte en un ProblemDetails
// (type/title/status/traceId) en un filtro que corre siempre.
public sealed class NoAutorizadoSinCuerpoResult : ActionResult
{
    public override void ExecuteResult(ActionContext context)
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status401Unauthorized;
    }
}
