using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Helpers;
using Peredent.Api.Models;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

// SCRUM-294: constancias odontológicas del expediente. SCRUM-295/297: todo el
// recurso es exclusivo del rol Odontólogo (el frontend también oculta la
// pestaña para Asistente). SCRUM-302: no hay endpoints para editar ni borrar;
// si una constancia tiene un error se emite una nueva.
[ApiController]
[Authorize(Roles = "Odontologo")]
public class ConstanciasController : ControllerBase
{
    private const int DiasReposoMaximo = 90;

    private readonly ApplicationDbContext _db;
    private readonly IConstanciaPdfService _pdfService;

    public ConstanciasController(ApplicationDbContext db, IConstanciaPdfService pdfService)
    {
        _db = db;
        _pdfService = pdfService;
    }

    // Datos para el formulario de "Nueva constancia" (SCRUM-296): los tipos,
    // los datos del odontólogo en sesión para el pie y el lugar de su última
    // constancia (de cualquier paciente) para precargarlo.
    [HttpGet("api/constancias/datos-nueva")]
    public async Task<ActionResult<DatosNuevaConstanciaDto>> GetDatosNueva()
    {
        var idUsuario = ObtenerIdUsuarioActual();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        var tipos = await _db.TiposConstanciaMedica
            .OrderBy(t => t.IdTipoConstanciaMedica)
            .Select(t => new TipoConstanciaDto { IdTipoConstancia = t.IdTipoConstanciaMedica, Nombre = t.NombreConstancia })
            .ToListAsync();

        var doctores = await DatosDoctoresAsync(new[] { idUsuario.Value });

        var lugar = await _db.ConstanciasMedicas
            .Where(c => c.IdUsuario == idUsuario.Value && c.LugarEmisionConstancia != null)
            .OrderByDescending(c => c.IdConstanciaMedica)
            .Select(c => c.LugarEmisionConstancia)
            .FirstOrDefaultAsync();

        return Ok(new DatosNuevaConstanciaDto
        {
            Tipos = tipos,
            Doctor = doctores.GetValueOrDefault(idUsuario.Value),
            Lugar = lugar,
        });
    }

    // SCRUM-300: constancias del paciente, la más reciente primero.
    [HttpGet("api/pacientes/{pacienteId:int}/constancias")]
    public async Task<ActionResult<IEnumerable<ConstanciaDto>>> GetByPaciente(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var constancias = await _db.ConstanciasMedicas
            .Include(c => c.TipoConstanciaMedica)
            .Where(c => c.IdPaciente == pacienteId)
            .OrderByDescending(c => c.FechaEmisionConstancia)
            .ThenByDescending(c => c.IdConstanciaMedica)
            .ToListAsync();

        var doctores = await DatosDoctoresAsync(constancias.Select(c => c.IdUsuario));

        return Ok(constancias.Select(c => ToDto(paciente, c, doctores.GetValueOrDefault(c.IdUsuario))));
    }

    [HttpPost("api/pacientes/{pacienteId:int}/constancias")]
    public async Task<ActionResult<ConstanciaDto>> Crear(int pacienteId, [FromBody] CrearConstanciaDto request)
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

        var tipo = request.IdTipoConstanciaMedica is null
            ? null
            : await _db.TiposConstanciaMedica.FindAsync(request.IdTipoConstanciaMedica.Value);
        if (tipo is null)
        {
            return BadRequest(new { message = "Selecciona el tipo de constancia.", campos = new[] { "idTipoConstanciaMedica" } });
        }

        // El pie de la constancia (nombre, colegiado, teléfono) sale de los
        // datos profesionales del odontólogo (PUT api/recetario/perfil o su
        // última receta); sin ellos la constancia quedaría sin firma
        // identificable.
        var doctores = await DatosDoctoresAsync(new[] { idUsuario.Value });
        var doctor = doctores.GetValueOrDefault(idUsuario.Value);
        if (doctor is null)
        {
            return BadRequest(new
            {
                message = "Registra tus datos profesionales (nombre, colegiado y teléfono) antes de emitir constancias.",
            });
        }

        var error = Validar(request, tipo);
        if (error is not null)
        {
            return BadRequest(error);
        }

        var esTratamiento = tipo.NombreConstancia == TipoConstanciaMedica.NombreTratamientoRealizado;
        var constancia = new ConstanciaMedica
        {
            IdPaciente = pacienteId,
            IdTipoConstanciaMedica = tipo.IdTipoConstanciaMedica,
            IdUsuario = idUsuario.Value,
            FechaAtencionConstancia = request.FechaAtencion!.Value.Date,
            DiasReposo = request.DiasReposo!.Value,
            TratamientoRealizadoConstancia = esTratamiento ? request.TratamientoRealizado!.Trim() : null,
            LugarEmisionConstancia = string.IsNullOrWhiteSpace(request.LugarEmision) ? null : request.LugarEmision.Trim(),
            FechaEmisionConstancia = FechaGuatemala.Ahora(),
            TipoConstanciaMedica = tipo,
        };

        _db.ConstanciasMedicas.Add(constancia);
        await _db.SaveChangesAsync();

        return Ok(ToDto(paciente, constancia, doctor));
    }

    // SCRUM-301: PDF para ver o imprimir la constancia con los datos con los
    // que se emitió.
    [HttpGet("api/pacientes/{pacienteId:int}/constancias/{constanciaId:int}/pdf")]
    public async Task<IActionResult> DescargarPdf(int pacienteId, int constanciaId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var constancia = await _db.ConstanciasMedicas
            .Include(c => c.TipoConstanciaMedica)
            .FirstOrDefaultAsync(c => c.IdConstanciaMedica == constanciaId && c.IdPaciente == pacienteId);
        if (constancia is null)
        {
            return NotFound(new { message = "Constancia no encontrada." });
        }

        var doctores = await DatosDoctoresAsync(new[] { constancia.IdUsuario });
        var pdf = _pdfService.Generar(ToDto(paciente, constancia, doctores.GetValueOrDefault(constancia.IdUsuario)));
        var nombreArchivo = $"Constancia {NombreArchivoValido($"{paciente.Nombres} {paciente.Apellidos}")}.pdf";

        return File(pdf, "application/pdf", nombreArchivo);
    }

    private static object? Validar(CrearConstanciaDto r, TipoConstanciaMedica tipo)
    {
        var esTratamiento = tipo.NombreConstancia == TipoConstanciaMedica.NombreTratamientoRealizado;

        var faltantes = new List<string>();
        if (r.FechaAtencion is null) faltantes.Add("fechaAtencion");
        if (r.DiasReposo is null) faltantes.Add("diasReposo");
        if (esTratamiento && string.IsNullOrWhiteSpace(r.TratamientoRealizado)) faltantes.Add("tratamientoRealizado");

        if (faltantes.Count > 0)
        {
            return new { message = "Completa los campos obligatorios de la constancia.", campos = faltantes };
        }

        if (r.FechaAtencion!.Value.Date > FechaGuatemala.Hoy())
        {
            return new { message = "La fecha de atención no puede ser posterior a hoy.", campos = new[] { "fechaAtencion" } };
        }

        if (r.DiasReposo < 0 || r.DiasReposo > DiasReposoMaximo)
        {
            return new { message = $"Los días de reposo deben estar entre 0 y {DiasReposoMaximo}.", campos = new[] { "diasReposo" } };
        }

        var largos = new List<string>();
        if (esTratamiento && r.TratamientoRealizado!.Trim().Length > 1000) largos.Add("tratamientoRealizado");
        if ((r.LugarEmision?.Trim().Length ?? 0) > 100) largos.Add("lugarEmision");

        return largos.Count > 0
            ? new { message = "Algunos campos superan la longitud permitida.", campos = largos }
            : null;
    }

    // Datos actuales de cada odontólogo: su DatosRecetario más reciente (cada
    // receta guarda una fila nueva, así que la última es la vigente). Si
    // cambia de teléfono o colegiado, las constancias salen con el dato nuevo.
    private async Task<Dictionary<int, DatosOdontologoRespuestaDto>> DatosDoctoresAsync(IEnumerable<int> idsUsuario)
    {
        var ids = idsUsuario.Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<int, DatosOdontologoRespuestaDto>();
        }

        var ultimos = await _db.DatosRecetarios
            .Where(d => ids.Contains(d.IdUsuario))
            .GroupBy(d => d.IdUsuario)
            .Select(g => g.Max(d => d.IdDatosRecetario))
            .ToListAsync();

        return await _db.DatosRecetarios
            .Where(d => ultimos.Contains(d.IdDatosRecetario))
            .ToDictionaryAsync(d => d.IdUsuario, d => new DatosOdontologoRespuestaDto
            {
                Nombres = d.NombresOdontologo,
                Apellidos = d.ApellidosOdontologo,
                Colegiado = d.ColegiadoOdontologo,
                Direccion = d.DireccionOdontologo,
                Telefono = d.TelefonoOdontologo,
                Correo = d.CorreoOdontologo,
            });
    }

    private static string NombreArchivoValido(string texto)
    {
        var invalidos = Path.GetInvalidFileNameChars();
        var limpio = new string(texto.Where(c => !invalidos.Contains(c)).ToArray());
        return limpio.Trim();
    }

    private static ConstanciaDto ToDto(Paciente paciente, ConstanciaMedica c, DatosOdontologoRespuestaDto? doctor) => new()
    {
        IdConstancia = c.IdConstanciaMedica,
        IdPaciente = paciente.IdPaciente,
        NombrePaciente = $"{paciente.Nombres} {paciente.Apellidos}".Trim(),
        SexoPaciente = paciente.Sexo,
        IdTipoConstancia = c.IdTipoConstanciaMedica,
        TipoConstancia = c.TipoConstanciaMedica?.NombreConstancia ?? string.Empty,
        FechaAtencion = c.FechaAtencionConstancia,
        DiasReposo = c.DiasReposo,
        TratamientoRealizado = c.TratamientoRealizadoConstancia,
        LugarEmision = c.LugarEmisionConstancia,
        FechaEmision = c.FechaEmisionConstancia,
        Doctor = doctor,
    };

    private int? ObtenerIdUsuarioActual() =>
        int.TryParse(User.FindFirstValue("idUsuario"), out var id) ? id : null;
}
