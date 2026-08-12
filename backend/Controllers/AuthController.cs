using Microsoft.AspNetCore.Mvc;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;

namespace Peredent.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    [HttpPost("login")]
    public ActionResult<AuthResponseDto> Login([FromBody] LoginDto request)
    {
        if (request.Usuario == "demo@peredent.com" && request.Clave == "123456")
        {
            return Ok(new AuthResponseDto
            {
                Token = "demo-token",
                Usuario = request.Usuario,
            });
        }

        return Unauthorized(new { message = "Credenciales incorrectas" });
    }
}
