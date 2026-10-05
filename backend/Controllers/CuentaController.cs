using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

// SCRUM-237 a 239: configuración de la propia cuenta. Entra cualquier rol
// autenticado, pero solo a SU cuenta: el idUsuario sale del token y nunca del
// cuerpo de la petición.
// Solo [Authorize], sin roles: la asistente y el odontólogo usan lo mismo.
[ApiController]
[Route("api/cuenta")]
[Authorize]
public class CuentaController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPasswordHasher _passwordHasher;

    public CuentaController(ApplicationDbContext db, IPasswordHasher passwordHasher)
    {
        _db = db;
        _passwordHasher = passwordHasher;
    }

    // SCRUM-237: datos de la cuenta para la pantalla de configuración.
    [HttpGet]
    public async Task<ActionResult<CuentaDto>> Get()
    {
        var usuario = await BuscarUsuarioActualAsync();
        if (usuario is null)
        {
            return Unauthorized();
        }

        return Ok(ToDto(usuario));
    }

    // SCRUM-237: cambio del correo (el único dato editable: la tabla no tiene
    // nombre ni teléfono). El correo vacío se guarda como NULL.
    [HttpPut("correo")]
    public async Task<ActionResult<CuentaDto>> ActualizarCorreo([FromBody] ActualizarCorreoDto request)
    {
        var usuario = await BuscarUsuarioActualAsync();
        if (usuario is null)
        {
            return Unauthorized();
        }

        if (!_passwordHasher.Verificar(request.ContrasenaActual ?? string.Empty, usuario.ContrasenaHash, usuario.Salt))
        {
            return BadRequest(new { message = "La contraseña actual no es correcta." });
        }

        var correo = string.IsNullOrWhiteSpace(request.Correo) ? null : ValidacionCorreo.Normalizar(request.Correo);

        if (correo is not null && !ValidacionCorreo.EsValido(correo))
        {
            return BadRequest(new { message = "Ingresa un correo electrónico válido." });
        }

        // Unicidad: se excluye el propio usuario (volver a guardar el mismo correo
        // no es un choque).
        if (correo is not null && await _db.Usuarios.AnyAsync(u => u.CorreoUsuario == correo && u.IdUsuario != usuario.IdUsuario))
        {
            return BadRequest(new { message = "Ese correo ya está en uso por otro usuario." });
        }

        usuario.CorreoUsuario = correo;
        await _db.SaveChangesAsync();

        return Ok(ToDto(usuario));
    }

    // SCRUM-238/239: cambio de contraseña. Valida la actual (identidad), que la
    // confirmación coincida, la política y que la nueva sea distinta de la actual.
    [HttpPut("cambiar-contrasena")]
    public async Task<ActionResult> CambiarContrasena([FromBody] CambiarContrasenaDto request)
    {
        var usuario = await BuscarUsuarioActualAsync();
        if (usuario is null)
        {
            return Unauthorized();
        }

        if (!_passwordHasher.Verificar(request.ContrasenaActual ?? string.Empty, usuario.ContrasenaHash, usuario.Salt))
        {
            return BadRequest(new { message = "La contraseña actual no es correcta." });
        }

        if (!string.Equals(request.NuevaContrasena, request.Confirmacion, StringComparison.Ordinal))
        {
            return BadRequest(new { message = "Las contraseñas no coinciden." });
        }

        var errorPolitica = PoliticaContrasena.Validar(request.NuevaContrasena);
        if (errorPolitica is not null)
        {
            return BadRequest(new { message = errorPolitica });
        }

        if (string.Equals(request.NuevaContrasena, request.ContrasenaActual, StringComparison.Ordinal))
        {
            return BadRequest(new { message = "La contraseña nueva debe ser distinta de la actual." });
        }

        // Se guarda con bcrypt (Salt vacío), igual que el resto del sistema.
        usuario.ContrasenaHash = _passwordHasher.Hashear(request.NuevaContrasena!);
        usuario.Salt = string.Empty;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Tu contraseña se cambió correctamente." });
    }

    // El usuario logueado sale del claim idUsuario que emite JwtTokenService.
    private Task<Usuario?> BuscarUsuarioActualAsync()
    {
        if (!int.TryParse(User.FindFirstValue("idUsuario"), out var idUsuario))
        {
            return Task.FromResult<Usuario?>(null);
        }

        return _db.Usuarios.Include(u => u.Rol).FirstOrDefaultAsync(u => u.IdUsuario == idUsuario);
    }

    private static CuentaDto ToDto(Usuario usuario) => new()
    {
        IdUsuario = usuario.IdUsuario,
        NombreUsuario = usuario.NombreUsuario,
        Rol = usuario.Rol?.NombreRol ?? string.Empty,
        Correo = usuario.CorreoUsuario,
        EsAdmin = usuario.EsAdmin,
    };
}
