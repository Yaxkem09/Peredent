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
[Authorize(Policy = "SoloAdmin")]
public class UsuariosController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPasswordHasher _passwordHasher;

    public UsuariosController(ApplicationDbContext db, IPasswordHasher passwordHasher)
    {
        _db = db;
        _passwordHasher = passwordHasher;
    }

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
    // para poblar el combo de "Nuevo usuario". Protegido igual que el resto del
    // controller: solo los admins crean usuarios, así que solo ellos la necesitan.
    [HttpGet("roles")]
    public async Task<ActionResult<IEnumerable<RolDto>>> GetRoles()
    {
        var roles = await _db.Roles
            .OrderBy(r => r.NombreRol)
            .Select(r => new RolDto { Id = r.IdRol, Nombre = r.NombreRol })
            .ToListAsync();

        return Ok(roles);
    }

    [HttpPost]
    public async Task<ActionResult<UsuarioDto>> Create([FromBody] CreateUsuarioDto request)
    {
        if (string.IsNullOrWhiteSpace(request.NombreUsuario) || string.IsNullOrWhiteSpace(request.Clave))
        {
            return BadRequest(new { message = "Nombre de usuario y contraseña son obligatorios." });
        }

        var nombreUsuario = request.NombreUsuario.Trim();

        if (await _db.Usuarios.AnyAsync(u => u.NombreUsuario == nombreUsuario))
        {
            return BadRequest(new { message = "Ya existe un usuario con ese nombre." });
        }

        if (!await _db.Roles.AnyAsync(r => r.IdRol == request.IdRol))
        {
            return BadRequest(new { message = "El rol indicado no existe." });
        }

        var salt = _passwordHasher.GenerarSalt();
        var usuario = new Usuario
        {
            NombreUsuario = nombreUsuario,
            Salt = salt,
            ContrasenaHash = _passwordHasher.HashClave(request.Clave, salt),
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
        IdRol = usuario.IdRol,
        Rol = usuario.Rol?.NombreRol ?? string.Empty,
        Estado = usuario.Estado,
        EsAdmin = usuario.EsAdmin,
        UltimoAcceso = usuario.UltimoAcceso,
    };
}
