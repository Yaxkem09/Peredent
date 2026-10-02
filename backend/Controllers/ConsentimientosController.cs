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

// SCRUM-254: consentimiento informado de exodoncia de terceros molares por
// paciente. SCRUM-256: crear, editar e imprimir es exclusivo del rol
// Odontólogo (el frontend también oculta la pestaña para Asistente).
[ApiController]
[Authorize(Roles = "Odontologo")]
public class ConsentimientosController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IConsentimientoPdfService _pdfService;

    public ConsentimientosController(ApplicationDbContext db, IConsentimientoPdfService pdfService)
    {
        _db = db;
        _pdfService = pdfService;
    }

    // SCRUM-261: todos los consentimientos del paciente, el más reciente primero.
    [HttpGet("api/pacientes/{pacienteId:int}/consentimientos")]
    public async Task<ActionResult<IEnumerable<ConsentimientoDto>>> GetByPaciente(int pacienteId)
    {
        if (!await _db.Pacientes.AnyAsync(p => p.IdPaciente == pacienteId))
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var consentimientos = await _db.ConsentimientosExodoncia
            .Include(c => c.Impresiones).ThenInclude(i => i.Usuario)
            .Where(c => c.IdPaciente == pacienteId)
            .OrderByDescending(c => c.FechaConsentimiento)
            .ThenByDescending(c => c.IdConsentimiento)
            .ToListAsync();

        return Ok(consentimientos.Select(ToDto));
    }

    // Doctor y lugar del último consentimiento que hizo el usuario en sesión
    // (de cualquier paciente), para precargar uno nuevo. 204 si nunca ha hecho
    // ninguno: así el formulario queda vacío en vez de traer datos de otro.
    [HttpGet("api/consentimientos/ultimo")]
    public async Task<IActionResult> GetUltimoDelUsuario()
    {
        var idUsuario = ObtenerIdUsuarioActual();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        var ultimo = await _db.ConsentimientosExodoncia
            .Where(c => c.IdUsuario == idUsuario.Value)
            .OrderByDescending(c => c.IdConsentimiento)
            .Select(c => new { c.NombreDoctor, c.ColegiadoDoctor, c.Lugar })
            .FirstOrDefaultAsync();

        return ultimo is null ? NoContent() : Ok(ultimo);
    }

    [HttpPost("api/pacientes/{pacienteId:int}/consentimientos")]
    public async Task<ActionResult<ConsentimientoDto>> Crear(int pacienteId, [FromBody] GuardarConsentimientoDto request)
    {
        var idUsuario = ObtenerIdUsuarioActual();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        if (!await _db.Pacientes.AnyAsync(p => p.IdPaciente == pacienteId))
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var error = Validar(request);
        if (error is not null)
        {
            return BadRequest(error);
        }

        // SCRUM-260: se guarda como Borrador y se puede seguir editando.
        var consentimiento = new ConsentimientoExodoncia
        {
            IdPaciente = pacienteId,
            IdUsuario = idUsuario.Value,
            Estado = ConsentimientoExodoncia.EstadoBorrador,
            FechaCreacion = FechaHoraGuatemala(),
        };
        Aplicar(consentimiento, request);

        _db.ConsentimientosExodoncia.Add(consentimiento);
        await _db.SaveChangesAsync();

        return Ok(ToDto(consentimiento));
    }

    [HttpPut("api/pacientes/{pacienteId:int}/consentimientos/{consentimientoId:int}")]
    public async Task<ActionResult<ConsentimientoDto>> Actualizar(
        int pacienteId, int consentimientoId, [FromBody] GuardarConsentimientoDto request)
    {
        var consentimiento = await BuscarAsync(pacienteId, consentimientoId);
        if (consentimiento is null)
        {
            return NotFound(new { message = "Consentimiento no encontrado." });
        }

        var error = Validar(request);
        if (error is not null)
        {
            return BadRequest(error);
        }

        Aplicar(consentimiento, request);
        consentimiento.FechaModificacion = FechaHoraGuatemala();

        // SCRUM-264: corregir uno ya impreso es válido, pero la copia impresa
        // deja de coincidir con lo guardado, así que vuelve a Borrador hasta
        // que se reimprima. Las impresiones anteriores quedan en el historial.
        consentimiento.Estado = ConsentimientoExodoncia.EstadoBorrador;

        await _db.SaveChangesAsync();

        return Ok(ToDto(consentimiento));
    }

    // SCRUM-262/263: genera el PDF con los datos llenados, pasa el estado a
    // Impreso y registra quién lo imprimió y cuándo (una fila por impresión).
    [HttpPost("api/pacientes/{pacienteId:int}/consentimientos/{consentimientoId:int}/imprimir")]
    public async Task<IActionResult> Imprimir(int pacienteId, int consentimientoId)
    {
        var idUsuario = ObtenerIdUsuarioActual();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        var consentimiento = await BuscarAsync(pacienteId, consentimientoId);
        if (consentimiento is null)
        {
            return NotFound(new { message = "Consentimiento no encontrado." });
        }

        var pdf = _pdfService.Generar(ToDto(consentimiento));

        consentimiento.Estado = ConsentimientoExodoncia.EstadoImpreso;
        _db.ConsentimientosImpresion.Add(new ConsentimientoImpresion
        {
            IdConsentimiento = consentimiento.IdConsentimiento,
            IdUsuario = idUsuario.Value,
            FechaImpresion = FechaHoraGuatemala(),
        });
        await _db.SaveChangesAsync();

        var nombreArchivo = $"Consentimiento exodoncia {NombreArchivoValido(consentimiento.NombrePaciente)}.pdf";
        return File(pdf, "application/pdf", nombreArchivo);
    }

    private Task<ConsentimientoExodoncia?> BuscarAsync(int pacienteId, int consentimientoId) =>
        _db.ConsentimientosExodoncia
            .Include(c => c.Impresiones).ThenInclude(i => i.Usuario)
            .FirstOrDefaultAsync(c => c.IdConsentimiento == consentimientoId && c.IdPaciente == pacienteId);

    // SCRUM-259: campos obligatorios. Devuelve en "campos" cuáles faltan para
    // que el frontend los señale. También se validan longitudes máximas para
    // no llegar a un error de truncado en la BD.
    private static object? Validar(GuardarConsentimientoDto r)
    {
        var faltantes = new List<string>();
        if (string.IsNullOrWhiteSpace(r.NombrePaciente)) faltantes.Add("nombrePaciente");
        if (string.IsNullOrWhiteSpace(r.DocumentoPaciente)) faltantes.Add("documentoPaciente");
        if (string.IsNullOrWhiteSpace(r.NombreDoctor)) faltantes.Add("nombreDoctor");
        if (string.IsNullOrWhiteSpace(r.Procedimiento)) faltantes.Add("procedimiento");
        if (r.FechaConsentimiento is null) faltantes.Add("fechaConsentimiento");

        if (faltantes.Count > 0)
        {
            return new { message = "Completa los campos obligatorios del consentimiento.", campos = faltantes };
        }

        var largos = new List<string>();
        if (r.NombrePaciente!.Trim().Length > 200) largos.Add("nombrePaciente");
        if (r.DocumentoPaciente!.Trim().Length > 30) largos.Add("documentoPaciente");
        if ((r.NombreRepresentante?.Trim().Length ?? 0) > 200) largos.Add("nombreRepresentante");
        if (r.NombreDoctor!.Trim().Length > 200) largos.Add("nombreDoctor");
        if ((r.ColegiadoDoctor?.Trim().Length ?? 0) > 50) largos.Add("colegiadoDoctor");
        if (r.Procedimiento!.Trim().Length > 300) largos.Add("procedimiento");
        if ((r.RiesgosEspecificos?.Trim().Length ?? 0) > 1000) largos.Add("riesgosEspecificos");
        if ((r.Observaciones?.Trim().Length ?? 0) > 1000) largos.Add("observaciones");
        if ((r.Lugar?.Trim().Length ?? 0) > 100) largos.Add("lugar");

        return largos.Count > 0
            ? new { message = "Algunos campos superan la longitud permitida.", campos = largos }
            : null;
    }

    private static void Aplicar(ConsentimientoExodoncia c, GuardarConsentimientoDto r)
    {
        c.NombrePaciente = r.NombrePaciente!.Trim();
        c.DocumentoPaciente = r.DocumentoPaciente!.Trim();
        c.NombreRepresentante = Opcional(r.NombreRepresentante);
        c.NombreDoctor = r.NombreDoctor!.Trim();
        c.ColegiadoDoctor = Opcional(r.ColegiadoDoctor);
        c.Procedimiento = r.Procedimiento!.Trim();
        c.RiesgosEspecificos = Opcional(r.RiesgosEspecificos);
        c.Observaciones = Opcional(r.Observaciones);
        c.Lugar = Opcional(r.Lugar);
        c.FechaConsentimiento = r.FechaConsentimiento!.Value.Date;
    }

    private static string? Opcional(string? valor) =>
        string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    private static DateTime FechaHoraGuatemala() =>
        DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-6), DateTimeKind.Unspecified);

    private static string NombreArchivoValido(string texto)
    {
        var invalidos = Path.GetInvalidFileNameChars();
        var limpio = new string(texto.Where(c => !invalidos.Contains(c)).ToArray());
        return limpio.Trim();
    }

    private static ConsentimientoDto ToDto(ConsentimientoExodoncia c) => new()
    {
        IdConsentimiento = c.IdConsentimiento,
        IdPaciente = c.IdPaciente,
        NombrePaciente = c.NombrePaciente,
        DocumentoPaciente = c.DocumentoPaciente,
        NombreRepresentante = c.NombreRepresentante,
        NombreDoctor = c.NombreDoctor,
        ColegiadoDoctor = c.ColegiadoDoctor,
        Procedimiento = c.Procedimiento,
        RiesgosEspecificos = c.RiesgosEspecificos,
        Observaciones = c.Observaciones,
        Lugar = c.Lugar,
        FechaConsentimiento = c.FechaConsentimiento,
        Estado = c.Estado,
        FechaCreacion = c.FechaCreacion,
        FechaModificacion = c.FechaModificacion,
        Impresiones = c.Impresiones
            .OrderByDescending(i => i.FechaImpresion)
            .Select(i => new ConsentimientoImpresionDto
            {
                FechaImpresion = i.FechaImpresion,
                Usuario = i.Usuario?.NombreUsuario ?? string.Empty,
            })
            .ToList(),
    };

    private int? ObtenerIdUsuarioActual() =>
        int.TryParse(User.FindFirstValue("idUsuario"), out var id) ? id : null;
}
