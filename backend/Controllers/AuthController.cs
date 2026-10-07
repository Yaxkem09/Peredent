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
        // Se puede entrar con el nombre de usuario o con el correo (el correo se
        // guarda normalizado en minúsculas y es único entre usuarios).
        var identificador = (request.Usuario ?? string.Empty).Trim();
        var correo = ValidacionCorreo.Normalizar(identificador);
        var usuario = await _db.Usuarios
            .Include(u => u.Rol)
            .FirstOrDefaultAsync(u => u.NombreUsuario == identificador || u.CorreoUsuario == correo);

        // SCRUM-230: la verificación es dual (bcrypt o el SHA2_256 legado de los
        // usuarios sembrados por SQL) y la resuelve el propio IPasswordHasher.
        var clave = request.Clave ?? string.Empty;
        var hashCoincide = usuario is not null &&
            _passwordHasher.Verificar(clave, usuario.ContrasenaHash, usuario.Salt);

        if (usuario is null || !usuario.Estado || !hashCoincide)
        {
            return Unauthorized(new { message = "Credenciales incorrectas" });
        }

        // SCRUM-230: si el usuario todavía tenía el hash legado, entra igual y acá se
        // le recalcula con bcrypt (Salt vacío: el salt va dentro del hash) sin pedirle
        // nada. Se guarda junto con UltimoAcceso, en el mismo SaveChanges.
        if (_passwordHasher.NecesitaMigracion(usuario.ContrasenaHash))
        {
            usuario.ContrasenaHash = _passwordHasher.Hashear(clave);
            usuario.Salt = string.Empty;
        }

        // Guatemala es UTC-6 todo el año (no observa horario de verano); guardamos
        // la hora local de Guatemala para que UltimoAcceso se lea directo en la BD
        // sin tener que convertir desde UTC (mismo criterio que el resto del backend).
        usuario.UltimoAcceso = DateTime.UtcNow.AddHours(-6);
        await _db.SaveChangesAsync();

        return Ok(new AuthResponseDto
        {
            Token = _jwtTokenService.GenerarToken(usuario),
            IdUsuario = usuario.IdUsuario,
            Usuario = usuario.NombreUsuario,
            Rol = usuario.Rol?.NombreRol ?? string.Empty,
            EsAdmin = usuario.EsAdmin,
        });
    }
}
