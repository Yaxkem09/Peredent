using Peredent.Api.Models;

namespace Peredent.Api.Services;

public interface IJwtTokenService
{
    string GenerarToken(Usuario usuario);
}
