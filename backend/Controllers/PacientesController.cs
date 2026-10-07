using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;

namespace Peredent.Api.Controllers;

[ApiController]
[Route("api/pacientes")]
[Authorize]
public class PacientesController : ControllerBase
{
    private const string NitConsumidorFinal = "CF";
    private const int NitLongitudMaxima = 15;

    private readonly ApplicationDbContext _db;

    public PacientesController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PacienteDto>>> GetAll()
    {
        var pacientes = await _db.Pacientes
            .OrderByDescending(p => p.FechaRegistro)
            .ToListAsync();

        return Ok(pacientes.Select(ToDto));
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<PacienteDto>>> Search([FromQuery] string? q)
    {
        var texto = (q ?? string.Empty).Trim();
        var query = _db.Pacientes.AsQueryable();

        if (!string.IsNullOrEmpty(texto))
        {
            query = query.Where(p =>
                EF.Functions.Like(EF.Functions.Collate(p.Nombres, "Latin1_General_CI_AI"), $"%{texto}%") ||
                EF.Functions.Like(EF.Functions.Collate(p.Apellidos, "Latin1_General_CI_AI"), $"%{texto}%") ||
                EF.Functions.Like(EF.Functions.Collate(p.Telefono, "Latin1_General_CI_AI"), $"%{texto}%"));
        }

        var pacientes = await query.OrderBy(p => p.Apellidos).ToListAsync();
        return Ok(pacientes.Select(ToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PacienteDto>> GetById(int id)
    {
        var paciente = await _db.Pacientes.FindAsync(id);
        if (paciente is null)
        {
            return NotFound();
        }

        return Ok(ToDto(paciente));
    }

    [HttpPost]
    public async Task<ActionResult<PacienteDto>> Create([FromBody] CreatePacienteDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Nombres) ||
            string.IsNullOrWhiteSpace(request.Apellidos) ||
            string.IsNullOrWhiteSpace(request.Telefono))
        {
            return BadRequest(new { message = "Nombres, apellidos y teléfono son obligatorios." });
        }

        if (NitExcedeLongitud(request.Nit))
        {
            return BadRequest(new { message = $"El NIT no puede tener más de {NitLongitudMaxima} caracteres." });
        }

        var paciente = new Paciente
        {
            Nombres = request.Nombres.Trim(),
            Apellidos = request.Apellidos.Trim(),
            Sexo = request.Sexo,
            FechaNacimiento = request.FechaNacimiento,
            Telefono = request.Telefono.Trim(),
            Correo = request.Correo,
            Nit = NormalizarNit(request.Nit),
            Direccion = request.Direccion,
            NombreEncargado = request.EncargadoNombre,
            TelefonoEncargado = request.EncargadoTelefono,
            FechaRegistro = DateTime.UtcNow,
        };

        _db.Pacientes.Add(paciente);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = paciente.IdPaciente }, ToDto(paciente));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PacienteDto>> Update(int id, [FromBody] CreatePacienteDto request)
    {
        var paciente = await _db.Pacientes.FindAsync(id);
        if (paciente is null)
        {
            return NotFound();
        }

        if (NitExcedeLongitud(request.Nit))
        {
            return BadRequest(new { message = $"El NIT no puede tener más de {NitLongitudMaxima} caracteres." });
        }

        paciente.Nombres = request.Nombres.Trim();
        paciente.Apellidos = request.Apellidos.Trim();
        paciente.Sexo = request.Sexo;
        paciente.FechaNacimiento = request.FechaNacimiento;
        paciente.Telefono = request.Telefono.Trim();
        paciente.Correo = request.Correo;
        paciente.Nit = NormalizarNit(request.Nit);
        paciente.Direccion = request.Direccion;
        paciente.NombreEncargado = request.EncargadoNombre;
        paciente.TelefonoEncargado = request.EncargadoTelefono;

        await _db.SaveChangesAsync();
        return Ok(ToDto(paciente));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var paciente = await _db.Pacientes.FindAsync(id);
        if (paciente is null)
        {
            return NotFound();
        }

        _db.Pacientes.Remove(paciente);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // SCRUM-223 / SCRUM-224: vacío => "CF"; cualquier otro valor se guarda tal cual (sin espacios de más).
    private static string NormalizarNit(string? nit)
    {
        var limpio = nit?.Trim();
        if (string.IsNullOrEmpty(limpio) || limpio.Equals(NitConsumidorFinal, StringComparison.OrdinalIgnoreCase))
        {
            return NitConsumidorFinal;
        }

        return limpio;
    }

    private static bool NitExcedeLongitud(string? nit) => (nit?.Trim().Length ?? 0) > NitLongitudMaxima;

    private static PacienteDto ToDto(Paciente paciente) => new()
    {
        Id = paciente.IdPaciente,
        Nombres = paciente.Nombres,
        Apellidos = paciente.Apellidos,
        Sexo = paciente.Sexo,
        FechaNacimiento = paciente.FechaNacimiento,
        Telefono = paciente.Telefono,
        Correo = paciente.Correo,
        Nit = paciente.Nit,
        Direccion = paciente.Direccion,
        EncargadoNombre = paciente.NombreEncargado,
        EncargadoTelefono = paciente.TelefonoEncargado,
        FechaRegistro = paciente.FechaRegistro,
    };
}
