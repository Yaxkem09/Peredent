using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;

namespace Peredent.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AuthController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto request)
    {
        var usuario = await _db.Usuarios
            .FirstOrDefaultAsync(u => u.NombreUsuario == request.Usuario);

        var hashCoincide = usuario is not null &&
            string.Equals(HashClave(request.Clave, usuario.Salt), usuario.ContrasenaHash, StringComparison.OrdinalIgnoreCase);

        if (usuario is null || !usuario.Estado || !hashCoincide)
        {
            return Unauthorized(new { message = "Credenciales incorrectas" });
        }

        usuario.UltimoAcceso = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new AuthResponseDto
        {
            Token = Guid.NewGuid().ToString("N"),
            Usuario = usuario.NombreUsuario,
        });
    }

    // Debe producir el mismo hash que HASHBYTES('SHA2_256', clave + salt) del script de
    // creación de la base. La comparación con el valor guardado es case-insensitive porque
    // SQL Server convierte ese binario a hexadecimal en mayúsculas.
    private static string HashClave(string clave, string salt)
    {
        var bytes = Encoding.UTF8.GetBytes(clave + salt);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
