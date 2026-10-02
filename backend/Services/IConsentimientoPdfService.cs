using Peredent.Api.DTOs.Response;

namespace Peredent.Api.Services;

public interface IConsentimientoPdfService
{
    byte[] Generar(ConsentimientoDto consentimiento);
}
