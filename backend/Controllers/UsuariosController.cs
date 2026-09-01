using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;

namespace Peredent.Api.Controllers;

[ApiController]
[Route("api/usuarios")]
[Authorize]
public class UsuariosController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public UsuariosController(ApplicationDbContext db)
    {
        _db = db;
    }

    // Solo usuarios activos: por ahora la única consumidora es el selector de
    // odontólogo al agendar una cita, no tendría sentido ofrecer uno dado de baja.
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UsuarioDto>>> GetAll()
    {
        var usuarios = await _db.Usuarios
            .Include(u => u.Rol)
            .Where(u => u.Estado)
            .OrderBy(u => u.NombreUsuario)
            .ToListAsync();

        return Ok(usuarios.Select(ToDto));
    }

    private static UsuarioDto ToDto(Usuario usuario) => new()
    {
        Id = usuario.IdUsuario,
        NombreUsuario = usuario.NombreUsuario,
        Rol = usuario.Rol?.NombreRol ?? string.Empty,
    };
}
