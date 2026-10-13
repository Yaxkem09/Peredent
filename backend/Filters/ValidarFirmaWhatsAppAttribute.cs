using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using Peredent.Api.Options;

namespace Peredent.Api.Filters;

// Valida el header X-Hub-Signature-256 que Meta agrega a cada notificación del
// webhook: "sha256=" + HMAC-SHA256 del cuerpo crudo con el App Secret.
// Es un filtro de recurso para correr ANTES del model binding: el payload solo
// se deserializa si la firma es válida. Activa el buffering de la petición
// únicamente en el endpoint que lo usa, lee los bytes exactos que llegaron y
// rebobina el stream para que [FromBody] pueda leerlo después.
public class ValidarFirmaWhatsAppAttribute : TypeFilterAttribute
{
    public ValidarFirmaWhatsAppAttribute() : base(typeof(ValidarFirmaWhatsAppFilter))
    {
    }
}

public class ValidarFirmaWhatsAppFilter : IAsyncResourceFilter
{
    public const string NombreHeader = "X-Hub-Signature-256";
    private const string PrefijoFirma = "sha256=";

    private readonly string _appSecret;
    private readonly ILogger<ValidarFirmaWhatsAppFilter> _logger;

    public ValidarFirmaWhatsAppFilter(IOptions<WhatsAppOptions> opciones, ILogger<ValidarFirmaWhatsAppFilter> logger)
    {
        _appSecret = opciones.Value.AppSecret;
        _logger = logger;
    }

    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        // Sin App Secret no hay forma de saber si la notificación viene de
        // Meta: se rechaza todo (nunca "sin secreto = abierto").
        if (string.IsNullOrWhiteSpace(_appSecret))
        {
            _logger.LogError("Webhook de WhatsApp rechazado: WHATSAPP_APP_SECRET no está configurada.");
            context.Result = new NoAutorizadoSinCuerpoResult();
            return;
        }

        var request = context.HttpContext.Request;
        var firmaRecibida = request.Headers[NombreHeader].ToString();

        request.EnableBuffering();
        byte[] cuerpo;
        using (var copia = new MemoryStream())
        {
            await request.Body.CopyToAsync(copia, context.HttpContext.RequestAborted);
            cuerpo = copia.ToArray();
        }
        request.Body.Position = 0;

        // Nunca se registra la firma recibida ni la calculada.
        if (!EsFirmaValida(firmaRecibida, cuerpo))
        {
            _logger.LogWarning("Webhook de WhatsApp rechazado: firma {Header} ausente o inválida.", NombreHeader);
            context.Result = new NoAutorizadoSinCuerpoResult();
            return;
        }

        await next();
    }

    private bool EsFirmaValida(string firmaRecibida, byte[] cuerpo)
    {
        if (!firmaRecibida.StartsWith(PrefijoFirma, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        byte[] bytesRecibidos;
        try
        {
            bytesRecibidos = Convert.FromHexString(firmaRecibida[PrefijoFirma.Length..]);
        }
        catch (FormatException)
        {
            return false;
        }

        var bytesEsperados = HMACSHA256.HashData(Encoding.UTF8.GetBytes(_appSecret), cuerpo);

        // Tiempo constante sobre el contenido; el largo (32 bytes) no es secreto.
        return CryptographicOperations.FixedTimeEquals(bytesEsperados, bytesRecibidos);
    }
}
