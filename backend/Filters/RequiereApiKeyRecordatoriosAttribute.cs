using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using Peredent.Api.Helpers;
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

    // Sin REMINDERS_API_KEY configurada se rechaza todo; comparación en tiempo
    // constante que no filtra la longitud de la key (ver ComparacionSegura).
    private bool EsValida(string apiKeyRecibida) =>
        ComparacionSegura.SecretosIguales(apiKeyRecibida, _apiKeyConfigurada);
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
