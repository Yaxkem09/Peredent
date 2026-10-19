using System.Text.RegularExpressions;
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

    // Teléfonos de Guatemala: exactamente 8 dígitos, un número por campo.
    private const int TelefonoDigitos = 8;

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
                EF.Functions.Like(EF.Functions.Collate(p.Telefono, "Latin1_General_CI_AI"), $"%{texto}%") ||
                EF.Functions.Like(EF.Functions.Collate(p.TelefonoSecundario!, "Latin1_General_CI_AI"), $"%{texto}%"));
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

        if (ValidarTelefonos(request) is string errorTelefono)
        {
            return BadRequest(new { message = errorTelefono });
        }

        var paciente = new Paciente
        {
            Nombres = request.Nombres.Trim(),
            Apellidos = request.Apellidos.Trim(),
            Sexo = request.Sexo,
            FechaNacimiento = request.FechaNacimiento,
            Telefono = NormalizarTelefono(request.Telefono)!,
            TelefonoSecundario = NormalizarTelefono(request.TelefonoSecundario),
            Correo = request.Correo,
            Nit = NormalizarNit(request.Nit),
            Direccion = request.Direccion,
            NombreEncargado = request.EncargadoNombre,
            TelefonoEncargado = NormalizarTelefono(request.EncargadoTelefono),
            FechaRegistro = DateTime.UtcNow,
            AceptaRecordatoriosWhatsApp = request.AceptaRecordatoriosWhatsApp ?? false,
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

        if (ValidarTelefonos(request) is string errorTelefono)
        {
            return BadRequest(new { message = errorTelefono });
        }

        paciente.Nombres = request.Nombres.Trim();
        paciente.Apellidos = request.Apellidos.Trim();
        paciente.Sexo = request.Sexo;
        paciente.FechaNacimiento = request.FechaNacimiento;
        paciente.Telefono = NormalizarTelefono(request.Telefono)!;
        paciente.TelefonoSecundario = NormalizarTelefono(request.TelefonoSecundario);
        paciente.Correo = request.Correo;
        paciente.Nit = NormalizarNit(request.Nit);
        paciente.Direccion = request.Direccion;
        paciente.NombreEncargado = request.EncargadoNombre;
        paciente.TelefonoEncargado = NormalizarTelefono(request.EncargadoTelefono);

        // Sin el campo en el request se conserva el consentimiento actual.
        if (request.AceptaRecordatoriosWhatsApp is not null)
        {
            paciente.AceptaRecordatoriosWhatsApp = request.AceptaRecordatoriosWhatsApp.Value;
        }

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

    // Se quitan espacios y guiones ("5512-3344", "5512 3344"): se guarda solo
    // el número. Vacío => null.
    private static string? NormalizarTelefono(string? telefono)
    {
        var limpio = Regex.Replace(telefono ?? string.Empty, @"[\s\-]", string.Empty);
        return limpio.Length == 0 ? null : limpio;
    }

    private static bool TelefonoValido(string? telefono) =>
        telefono is not null && telefono.Length == TelefonoDigitos && telefono.All(char.IsAsciiDigit);

    // Un número por campo: así no vuelven a entrar dos teléfonos juntos en
    // Telefono ("42246235\ 34401287"). El principal es obligatorio; el
    // secundario y el del encargado, opcionales pero con el mismo formato.
    private static string? ValidarTelefonos(CreatePacienteDto request)
    {
        var principal = NormalizarTelefono(request.Telefono);
        if (principal is null)
        {
            return "El teléfono es obligatorio.";
        }

        if (!TelefonoValido(principal))
        {
            return $"El teléfono debe tener {TelefonoDigitos} dígitos. Si el paciente tiene otro número, ingrésalo en \"Teléfono 2\".";
        }

        var secundario = NormalizarTelefono(request.TelefonoSecundario);
        if (secundario is not null && !TelefonoValido(secundario))
        {
            return $"El teléfono 2 debe tener {TelefonoDigitos} dígitos.";
        }

        var encargado = NormalizarTelefono(request.EncargadoTelefono);
        if (encargado is not null && !TelefonoValido(encargado))
        {
            return $"El teléfono del encargado debe tener {TelefonoDigitos} dígitos.";
        }

        return null;
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
        TelefonoSecundario = paciente.TelefonoSecundario,
        Correo = paciente.Correo,
        Nit = paciente.Nit,
        Direccion = paciente.Direccion,
        EncargadoNombre = paciente.NombreEncargado,
        EncargadoTelefono = paciente.TelefonoEncargado,
        FechaRegistro = paciente.FechaRegistro,
        AceptaRecordatoriosWhatsApp = paciente.AceptaRecordatoriosWhatsApp,
    };
}
