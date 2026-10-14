using Peredent.Api.DTOs.Response;

namespace Peredent.Api.Services;

public interface IConstanciaPdfService
{
    byte[] Generar(ConstanciaDto constancia);
}
