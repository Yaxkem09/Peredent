using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

// SCRUM-231 a 236: recuperación de contraseña olvidada. Son endpoints públicos
// (los usa alguien que no puede entrar), por eso [AllowAnonymous]: no hay token
// que exigir.
[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public class RecuperacionContrasenaController : ControllerBase
{
    private readonly IRecuperacionContrasenaService _recuperacion;

    public RecuperacionContrasenaController(IRecuperacionContrasenaService recuperacion)
    {
        _recuperacion = recuperacion;
    }

    // SCRUM-231/232/233: pide el enlace de restablecimiento. Responde 200 con el
    // MISMO mensaje genérico exista o no la cuenta (y aunque no se pueda enviar el
    // correo), para no revelar qué correos están registrados.
    [HttpPost("olvide-contrasena")]
    public async Task<ActionResult> Solicitar([FromBody] OlvideContrasenaDto request)
    {
        var mensaje = await _recuperacion.SolicitarAsync(request.Identificador ?? string.Empty);

        return Ok(new { message = mensaje });
    }

    // SCRUM-234: valida el token del enlace antes de mostrar el formulario.
    [HttpPost("restablecer-contrasena/validar")]
    public async Task<ActionResult<TokenValidadoDto>> Validar([FromBody] ValidarTokenDto request)
    {
        var valido = await _recuperacion.TokenEsValidoAsync(request.Token ?? string.Empty);

        return Ok(new TokenValidadoDto { Valido = valido });
    }

    // SCRUM-234/235/236: guarda la contraseña nueva (bcrypt + política), notifica el
    // éxito e invalida el enlace.
    [HttpPost("restablecer-contrasena")]
    public async Task<ActionResult> Restablecer([FromBody] RestablecerContrasenaDto request)
    {
        var resultado = await _recuperacion.RestablecerAsync(
            request.Token ?? string.Empty,
            request.NuevaContrasena ?? string.Empty,
            request.Confirmacion ?? string.Empty);

        if (!resultado.Exitoso)
        {
            return BadRequest(new { message = resultado.Mensaje });
        }

        return Ok(new { message = resultado.Mensaje });
    }
}
