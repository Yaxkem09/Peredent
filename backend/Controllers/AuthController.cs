using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IPasswordHasher _passwordHasher;

    public AuthController(ApplicationDbContext db, IJwtTokenService jwtTokenService, IPasswordHasher passwordHasher)
    {
        _db = db;
        _jwtTokenService = jwtTokenService;
        _passwordHasher = passwordHasher;
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto request)
    {
        var usuario = await _db.Usuarios
            .Include(u => u.Rol)
            .FirstOrDefaultAsync(u => u.NombreUsuario == request.Usuario);

        var hashCoincide = usuario is not null &&
            string.Equals(_passwordHasher.HashClave(request.Clave, usuario.Salt), usuario.ContrasenaHash, StringComparison.OrdinalIgnoreCase);

        if (usuario is null || !usuario.Estado || !hashCoincide)
        {
            return Unauthorized(new { message = "Credenciales incorrectas" });
        }

        usuario.UltimoAcceso = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new AuthResponseDto
        {
            Token = _jwtTokenService.GenerarToken(usuario),
            Usuario = usuario.NombreUsuario,
            Rol = usuario.Rol?.NombreRol ?? string.Empty,
            EsAdmin = usuario.EsAdmin,
        });
    }
}
