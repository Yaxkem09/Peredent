using Peredent.Api.DTOs.Response;

namespace Peredent.Api.Services;

public interface IRecetaPdfService
{
    byte[] Generar(RecetaDto receta);
}
