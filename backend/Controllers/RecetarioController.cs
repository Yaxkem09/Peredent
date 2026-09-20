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

// SCRUM-92: recetario del expediente. Todo el recurso es exclusivo del rol
// Odontólogo (igual que oculta la pestaña en el frontend para Asistente):
// una asistente no genera ni ve recetas médicas.
[ApiController]
[Authorize(Roles = "Odontologo")]
public class RecetarioController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IRecetaPdfService _recetaPdfService;

    public RecetarioController(ApplicationDbContext db, IRecetaPdfService recetaPdfService)
    {
        _db = db;
        _recetaPdfService = recetaPdfService;
    }

    // Datos del odontólogo/clínica de la receta más reciente que emitió el
    // usuario en sesión (SCRUM-93): se usan para precargar el formulario de
    // "Nueva receta", pero no son un perfil editable en el sentido estricto —
    // cada receta nueva guarda su propia instantánea (ver DatosRecetario).
    [HttpGet("api/recetario/perfil")]
    public async Task<ActionResult<DatosOdontologoRespuestaDto>> GetPerfil()
    {
        var idUsuario = ObtenerIdUsuarioActual();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        var ultimo = await _db.DatosRecetarios
            .Where(d => d.IdUsuario == idUsuario.Value)
            .OrderByDescending(d => d.IdDatosRecetario)
            .FirstOrDefaultAsync();

        if (ultimo is null)
        {
            return NoContent();
        }

        return Ok(new DatosOdontologoRespuestaDto
        {
            Nombres = ultimo.NombresOdontologo,
            Apellidos = ultimo.ApellidosOdontologo,
            Colegiado = ultimo.ColegiadoOdontologo,
            Direccion = ultimo.DireccionOdontologo,
            Telefono = ultimo.TelefonoOdontologo,
            Correo = ultimo.CorreoOdontologo,
        });
    }

    // Menú principal "Recetario" (SCRUM-101): busca recetas de todos los
    // pacientes por nombre, apellido o teléfono, insensible a mayúsculas y
    // acentos (mismo criterio que /api/pacientes/search). Sin texto de
    // búsqueda muestra solo las más recientes, para no traer de golpe todo el
    // historial de la clínica.
    [HttpGet("api/recetario")]
    public async Task<ActionResult<IEnumerable<RecetaDto>>> Buscar([FromQuery] string? buscar)
    {
        var texto = (buscar ?? string.Empty).Trim();

        var query = _db.Recetarios
            .Include(r => r.Paciente)
            .Include(r => r.DatosRecetario)
            .Include(r => r.Medicamentos)
            .AsQueryable();

        if (!string.IsNullOrEmpty(texto))
        {
            query = query.Where(r =>
                EF.Functions.Like(EF.Functions.Collate(r.Paciente!.Nombres, "Latin1_General_CI_AI"), $"%{texto}%")
                || EF.Functions.Like(EF.Functions.Collate(r.Paciente!.Apellidos, "Latin1_General_CI_AI"), $"%{texto}%")
                || EF.Functions.Like(EF.Functions.Collate(r.Paciente!.Telefono, "Latin1_General_CI_AI"), $"%{texto}%"));
        }

        var limite = string.IsNullOrEmpty(texto) ? 20 : 100;

        var recetas = await query
            .OrderByDescending(r => r.FechaEmisionRecetario)
            .ThenByDescending(r => r.IdRecetario)
            .Take(limite)
            .ToListAsync();

        return Ok(recetas.Select(r => ToDto(r.Paciente!, r)));
    }

    [HttpGet("api/pacientes/{pacienteId:int}/recetario")]
    public async Task<ActionResult<IEnumerable<RecetaDto>>> GetByPaciente(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var recetas = await _db.Recetarios
            .Include(r => r.DatosRecetario)
            .Include(r => r.Medicamentos)
            .Where(r => r.IdPaciente == pacienteId)
            .OrderByDescending(r => r.FechaEmisionRecetario)
            .ThenByDescending(r => r.IdRecetario)
            .ToListAsync();

        return Ok(recetas.Select(r => ToDto(paciente, r)));
    }

    [HttpPost("api/pacientes/{pacienteId:int}/recetario")]
    public async Task<ActionResult<RecetaDto>> Crear(int pacienteId, [FromBody] CrearRecetaDto request)
    {
        var idUsuario = ObtenerIdUsuarioActual();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var odontologo = request.Odontologo;
        if (string.IsNullOrWhiteSpace(odontologo.Nombres)
            || string.IsNullOrWhiteSpace(odontologo.Apellidos)
            || string.IsNullOrWhiteSpace(odontologo.Colegiado)
            || string.IsNullOrWhiteSpace(odontologo.Direccion)
            || string.IsNullOrWhiteSpace(odontologo.Telefono)
            || string.IsNullOrWhiteSpace(odontologo.Correo))
        {
            return BadRequest(new { message = "Completa los datos del odontólogo y la clínica antes de guardar la receta." });
        }

        var medicamentosValidos = request.Medicamentos
            .Where(m => !string.IsNullOrWhiteSpace(m.Nombre))
            .ToList();

        if (medicamentosValidos.Count == 0)
        {
            return BadRequest(new { message = "Agrega al menos un medicamento con nombre." });
        }

        var receta = new Recetario
        {
            IdPaciente = pacienteId,
            DatosRecetario = new DatosRecetario
            {
                IdUsuario = idUsuario.Value,
                NombresOdontologo = odontologo.Nombres.Trim(),
                ApellidosOdontologo = odontologo.Apellidos.Trim(),
                ColegiadoOdontologo = odontologo.Colegiado.Trim(),
                DireccionOdontologo = odontologo.Direccion.Trim(),
                TelefonoOdontologo = odontologo.Telefono.Trim(),
                CorreoOdontologo = odontologo.Correo.Trim(),
            },
            FechaEmisionRecetario = FechaHoraGuatemala(),
            NotasAdicionalesRecetario = string.IsNullOrWhiteSpace(request.NotasAdicionales)
                ? null
                : request.NotasAdicionales.Trim(),
            Medicamentos = medicamentosValidos.Select(m => new MedicamentoReceta
            {
                Nombre = m.Nombre.Trim(),
                PresentacionReceta = m.Presentacion?.Trim() ?? string.Empty,
                IndicacionesReceta = m.Indicaciones?.Trim() ?? string.Empty,
            }).ToList(),
        };

        _db.Recetarios.Add(receta);
        await _db.SaveChangesAsync();

        return Ok(ToDto(paciente, receta));
    }

    [HttpDelete("api/pacientes/{pacienteId:int}/recetario/{recetaId:int}")]
    public async Task<IActionResult> Eliminar(int pacienteId, int recetaId)
    {
        var receta = await _db.Recetarios
            .FirstOrDefaultAsync(r => r.IdRecetario == recetaId && r.IdPaciente == pacienteId);

        if (receta is null)
        {
            return NotFound(new { message = "Receta no encontrada." });
        }

        _db.Recetarios.Remove(receta);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // SCRUM-95: la misma receta exportada como PDF descargable.
    [HttpGet("api/pacientes/{pacienteId:int}/recetario/{recetaId:int}/pdf")]
    public async Task<IActionResult> DescargarPdf(int pacienteId, int recetaId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var receta = await _db.Recetarios
            .Include(r => r.DatosRecetario)
            .Include(r => r.Medicamentos)
            .FirstOrDefaultAsync(r => r.IdRecetario == recetaId && r.IdPaciente == pacienteId);

        if (receta is null)
        {
            return NotFound(new { message = "Receta no encontrada." });
        }

        var dto = ToDto(paciente, receta);
        var pdf = _recetaPdfService.Generar(dto);
        var nombreArchivo = $"Receta {NombreArchivoValido($"{paciente.Nombres} {paciente.Apellidos}")}.pdf";

        return File(pdf, "application/pdf", nombreArchivo);
    }

    private static DateTime FechaHoraGuatemala() =>
        DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-6), DateTimeKind.Unspecified);

    // Conserva espacios y mayúsculas del nombre del paciente (para que el
    // archivo descargado se vea como "Receta Juan Pérez.pdf"); solo quita
    // caracteres que Windows/otros SO no permiten en un nombre de archivo.
    private static string NombreArchivoValido(string texto)
    {
        var invalidos = Path.GetInvalidFileNameChars();
        var limpio = new string(texto.Where(c => !invalidos.Contains(c)).ToArray());
        return limpio.Trim();
    }

    private static RecetaDto ToDto(Paciente paciente, Recetario r) => new()
    {
        IdReceta = r.IdRecetario,
        IdPaciente = paciente.IdPaciente,
        NombrePaciente = $"{paciente.Nombres} {paciente.Apellidos}".Trim(),
        FechaEmision = r.FechaEmisionRecetario,
        NotasAdicionales = r.NotasAdicionalesRecetario,
        Odontologo = new DatosOdontologoRespuestaDto
        {
            Nombres = r.DatosRecetario?.NombresOdontologo ?? string.Empty,
            Apellidos = r.DatosRecetario?.ApellidosOdontologo ?? string.Empty,
            Colegiado = r.DatosRecetario?.ColegiadoOdontologo ?? string.Empty,
            Direccion = r.DatosRecetario?.DireccionOdontologo ?? string.Empty,
            Telefono = r.DatosRecetario?.TelefonoOdontologo ?? string.Empty,
            Correo = r.DatosRecetario?.CorreoOdontologo ?? string.Empty,
        },
        Medicamentos = r.Medicamentos.Select(m => new MedicamentoRecetaRespuestaDto
        {
            Nombre = m.Nombre,
            Presentacion = m.PresentacionReceta,
            Indicaciones = m.IndicacionesReceta,
        }).ToList(),
    };

    private int? ObtenerIdUsuarioActual() =>
        int.TryParse(User.FindFirstValue("idUsuario"), out var id) ? id : null;
}
