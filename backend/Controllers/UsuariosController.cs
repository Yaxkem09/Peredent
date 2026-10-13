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

[ApiController]
[Route("api/usuarios")]
[Authorize]
public class UsuariosController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPasswordHasher _passwordHasher;

    public UsuariosController(ApplicationDbContext db, IPasswordHasher passwordHasher)
    {
        _db = db;
        _passwordHasher = passwordHasher;
    }

    // Sin filtrar por Estado ni restringir a admins: cualquier usuario autenticado
    // la usa (por ejemplo, el selector de odontólogo al agendar una cita); la
    // pantalla de administración de usuarios filtra activos/inactivos en el frontend.
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UsuarioDto>>> GetAll()
    {
        var usuarios = await _db.Usuarios
            .Include(u => u.Rol)
            .OrderBy(u => u.NombreUsuario)
            .ToListAsync();

        return Ok(usuarios.Select(ToDto));
    }

    // Lista completa de la tabla Rol (no solo los roles que ya tienen usuarios),
    // para poblar el combo de "Nuevo usuario". Solo los admins crean usuarios,
    // así que solo ellos la necesitan.
    [HttpGet("roles")]
    [Authorize(Policy = "SoloAdmin")]
    public async Task<ActionResult<IEnumerable<RolDto>>> GetRoles()
    {
        var roles = await _db.Roles
            .OrderBy(r => r.NombreRol)
            .Select(r => new RolDto { Id = r.IdRol, Nombre = r.NombreRol })
            .ToListAsync();

        return Ok(roles);
    }

    [HttpPost]
    [Authorize(Policy = "SoloAdmin")]
    public async Task<ActionResult<UsuarioDto>> Create([FromBody] CreateUsuarioDto request)
    {
        if (string.IsNullOrWhiteSpace(request.NombreUsuario) || string.IsNullOrWhiteSpace(request.Clave))
        {
            return BadRequest(new { message = "Nombre de usuario y contraseña son obligatorios." });
        }

        // SCRUM-235: la contraseña del alta también cumple la política (antes solo se
        // exigía que no estuviera vacía).
        var errorPolitica = PoliticaContrasena.Validar(request.Clave);
        if (errorPolitica is not null)
        {
            return BadRequest(new { message = errorPolitica });
        }

        var nombreUsuario = request.NombreUsuario.Trim();

        // Se puede iniciar sesión con usuario o correo: un usuario con "@" podría
        // confundirse con un correo (misma regla que en CuentaController).
        if (nombreUsuario.Contains('@'))
        {
            return BadRequest(new { message = "El nombre de usuario no puede tener el carácter @." });
        }

        // SCRUM-237: el correo es opcional (la columna admite NULL); si viene, se
        // valida con la misma regla que el cambio de correo de la propia cuenta.
        var correo = string.IsNullOrWhiteSpace(request.Correo) ? null : ValidacionCorreo.Normalizar(request.Correo);

        if (correo is not null && !ValidacionCorreo.EsValido(correo))
        {
            return BadRequest(new { message = "Ingresa un correo electrónico válido." });
        }

        if (await _db.Usuarios.AnyAsync(u => u.NombreUsuario == nombreUsuario))
        {
            return BadRequest(new { message = "Ya existe un usuario con ese nombre." });
        }

        if (correo is not null && await _db.Usuarios.AnyAsync(u => u.CorreoUsuario == correo))
        {
            return BadRequest(new { message = "Ya existe un usuario con ese correo." });
        }

        if (!await _db.Roles.AnyAsync(r => r.IdRol == request.IdRol))
        {
            return BadRequest(new { message = "El rol indicado no existe." });
        }

        // SCRUM-230: las contraseñas nuevas se guardan con bcrypt. La columna Salt
        // se conserva (es NOT NULL) pero queda vacía: el salt va dentro del hash.
        var usuario = new Usuario
        {
            NombreUsuario = nombreUsuario,
            CorreoUsuario = correo,
            Salt = string.Empty,
            ContrasenaHash = _passwordHasher.Hashear(request.Clave),
            IdRol = request.IdRol,
            Estado = true,
            EsAdmin = request.EsAdmin,
        };

        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync();

        var creado = await BuscarConRolAsync(usuario.IdUsuario);
        return Ok(ToDto(creado!));
    }

    [HttpPatch("{id:int}/habilitar")]
    [Authorize(Policy = "SoloAdmin")]
    public async Task<ActionResult<UsuarioDto>> Habilitar(int id)
    {
        var usuario = await BuscarConRolAsync(id);
        if (usuario is null)
        {
            return NotFound();
        }

        usuario.Estado = true;
        await _db.SaveChangesAsync();
        return Ok(ToDto(usuario));
    }

    [HttpPatch("{id:int}/deshabilitar")]
    [Authorize(Policy = "SoloAdmin")]
    public async Task<ActionResult<UsuarioDto>> Deshabilitar(int id)
    {
        var usuario = await BuscarConRolAsync(id);
        if (usuario is null)
        {
            return NotFound();
        }

        if (EsUsuarioActual(usuario))
        {
            return BadRequest(new { message = "No podés deshabilitar tu propio usuario." });
        }

        if (await EsUltimoAdminActivoAsync(usuario))
        {
            return BadRequest(new { message = "No se puede deshabilitar al último administrador activo." });
        }

        usuario.Estado = false;
        await _db.SaveChangesAsync();
        return Ok(ToDto(usuario));
    }

    [HttpPatch("{id:int}/otorgar-admin")]
    [Authorize(Policy = "SoloAdmin")]
    public async Task<ActionResult<UsuarioDto>> OtorgarAdmin(int id)
    {
        var usuario = await BuscarConRolAsync(id);
        if (usuario is null)
        {
            return NotFound();
        }

        usuario.EsAdmin = true;
        await _db.SaveChangesAsync();
        return Ok(ToDto(usuario));
    }

    [HttpPatch("{id:int}/revocar-admin")]
    [Authorize(Policy = "SoloAdmin")]
    public async Task<ActionResult<UsuarioDto>> RevocarAdmin(int id)
    {
        var usuario = await BuscarConRolAsync(id);
        if (usuario is null)
        {
            return NotFound();
        }

        if (EsUsuarioActual(usuario))
        {
            return BadRequest(new { message = "No podés quitarte el permiso de administrador a vos mismo." });
        }

        if (await EsUltimoAdminActivoAsync(usuario))
        {
            return BadRequest(new { message = "No se puede quitar el permiso de administrador al último administrador activo." });
        }

        usuario.EsAdmin = false;
        await _db.SaveChangesAsync();
        return Ok(ToDto(usuario));
    }

    private Task<Usuario?> BuscarConRolAsync(int id) =>
        _db.Usuarios.Include(u => u.Rol).FirstOrDefaultAsync(u => u.IdUsuario == id);

    private bool EsUsuarioActual(Usuario usuario) =>
        string.Equals(usuario.NombreUsuario, User.FindFirstValue(ClaimTypes.NameIdentifier), StringComparison.Ordinal);

    // El guard se evalúa sobre el estado ANTES de aplicar el cambio: si este
    // usuario ya cuenta como el único admin activo, no importa quién intente
    // deshabilitarlo o quitarle esAdmin, queda bloqueado.
    private async Task<bool> EsUltimoAdminActivoAsync(Usuario usuario) =>
        usuario.EsAdmin && usuario.Estado &&
        await _db.Usuarios.CountAsync(u => u.EsAdmin && u.Estado) <= 1;

    private static UsuarioDto ToDto(Usuario usuario) => new()
    {
        Id = usuario.IdUsuario,
        NombreUsuario = usuario.NombreUsuario,
        Correo = usuario.CorreoUsuario,
        IdRol = usuario.IdRol,
        Rol = usuario.Rol?.NombreRol ?? string.Empty,
        Estado = usuario.Estado,
        EsAdmin = usuario.EsAdmin,
        UltimoAcceso = usuario.UltimoAcceso,
    };
}
