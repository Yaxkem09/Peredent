using System.IO.Compression;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;
using Peredent.Api.Services;

namespace Peredent.Api.Controllers;

[ApiController]
[Route("api/panoramicas")]
[Authorize]
public class PanoramicasController : ControllerBase
{
    private const long TamanoMaximoBytes = 15L * 1024 * 1024;

    private static readonly TimeSpan DuracionUrlFirmada = TimeSpan.FromMinutes(30);

    private const string ContentTypeDocx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    private readonly ApplicationDbContext _db;
    private readonly IR2StorageService _r2Storage;

    public PanoramicasController(ApplicationDbContext db, IR2StorageService r2Storage)
    {
        _db = db;
        _r2Storage = r2Storage;
    }

    [HttpPost("/api/pacientes/{pacienteId:int}/panoramicas")]
    public async Task<ActionResult<PanoramicaDto>> Subir(int pacienteId, [FromForm] IFormFile archivo)
    {
        var pacienteExiste = await _db.Pacientes.AnyAsync(p => p.IdPaciente == pacienteId);
        if (!pacienteExiste)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        if (archivo is null || archivo.Length == 0)
        {
            return BadRequest(new { message = "Debe adjuntar un archivo." });
        }

        // Se valida el tamaño antes de leer el contenido, para no volcar a
        // memoria un archivo enorme solo para descubrir después que se rechaza.
        if (archivo.Length > TamanoMaximoBytes)
        {
            return BadRequest(new { message = "El archivo supera el tamaño máximo permitido (15 MB)." });
        }

        // Además de imágenes se aceptan documentos Word (.docx). No se filtra
        // por el Content-Type declarado: varios navegadores mandan un .docx
        // como application/octet-stream. Se filtra por extensión y luego por
        // el contenido real.
        var extensionDeclarada = Path.GetExtension(archivo.FileName).ToLowerInvariant();
        if (extensionDeclarada is not (".jpg" or ".jpeg" or ".png" or ".docx"))
        {
            return BadRequest(new { message = "Solo se permiten imágenes JPG o PNG y documentos Word (.docx)." });
        }

        using var contenido = new MemoryStream();
        await archivo.CopyToAsync(contenido);
        var bytes = contenido.ToArray();

        // El Content-Type declarado lo controla el cliente y puede mentir; tanto
        // la extensión como el Content-Type real que se sube a R2 se deciden
        // por los magic bytes, no por lo que dijo el cliente.
        var tipoDetectado = DetectarTipoPorMagicBytes(bytes);
        if (tipoDetectado is null || (tipoDetectado.Value.Extension == "docx") != (extensionDeclarada == ".docx"))
        {
            return BadRequest(new { message = "El contenido del archivo no corresponde a una imagen JPG/PNG ni a un documento Word válido." });
        }

        var (extension, contentType) = tipoDetectado.Value;
        var objectKey = $"pacientes/{pacienteId}/{Guid.NewGuid()}.{extension}";

        contenido.Position = 0;
        await _r2Storage.SubirArchivoAsync(contenido, objectKey, contentType);

        var panoramica = new Panoramica
        {
            IdPaciente = pacienteId,
            KeyPanoramicaR2 = objectKey,
            FechaSubida = DateTime.UtcNow,
        };

        _db.Panoramicas.Add(panoramica);
        await _db.SaveChangesAsync();

        var urlFirmada = await GenerarUrlAsync(panoramica);

        return Created($"/api/panoramicas/{panoramica.IdPanoramica}", ToDto(panoramica, urlFirmada));
    }

    [HttpGet("/api/pacientes/{pacienteId:int}/panoramicas")]
    public async Task<ActionResult<IEnumerable<PanoramicaDto>>> GetByPaciente(int pacienteId)
    {
        var pacienteExiste = await _db.Pacientes.AnyAsync(p => p.IdPaciente == pacienteId);
        if (!pacienteExiste)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var panoramicas = await _db.Panoramicas
            .Where(p => p.IdPaciente == pacienteId && p.FechaEliminacion == null)
            .OrderByDescending(p => p.FechaSubida)
            .ToListAsync();

        // GenerarUrlFirmadaAsync solo firma localmente con las credenciales
        // (no hace una llamada de red a R2), así que hacerlo en bucle aquí es barato.
        var dtos = new List<PanoramicaDto>(panoramicas.Count);
        foreach (var panoramica in panoramicas)
        {
            var urlFirmada = await GenerarUrlAsync(panoramica);
            dtos.Add(ToDto(panoramica, urlFirmada));
        }

        return Ok(dtos);
    }

    // Contenido de un documento Word para la vista previa en el navegador. Pasa
    // por el backend (y no por la URL firmada) porque el frontend lo lee con
    // fetch y R2 exigiría CORS; además la URL firmada fuerza la descarga.
    [HttpGet("{id:int}/contenido")]
    public async Task<IActionResult> GetContenido(int id)
    {
        var panoramica = await _db.Panoramicas
            .FirstOrDefaultAsync(p => p.IdPanoramica == id && p.FechaEliminacion == null);

        if (panoramica is null || !EsDocumento(panoramica))
        {
            return NotFound(new { message = "El documento indicado no existe." });
        }

        var bytes = await _r2Storage.DescargarArchivoAsync(panoramica.KeyPanoramicaR2);
        return File(bytes, ContentTypeDocx);
    }

    // Solo el odontólogo puede eliminar una radiografía; la asistente sube y consulta.
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Odontologo")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var panoramica = await _db.Panoramicas
            .FirstOrDefaultAsync(p => p.IdPanoramica == id && p.FechaEliminacion == null);

        if (panoramica is null)
        {
            return NotFound(new { message = "La panorámica indicada no existe." });
        }

        await _r2Storage.EliminarArchivoAsync(panoramica.KeyPanoramicaR2);

        panoramica.FechaEliminacion = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    private static (string Extension, string ContentType)? DetectarTipoPorMagicBytes(byte[] contenido)
    {
        if (contenido.Length >= 4 &&
            contenido[0] == 0x89 && contenido[1] == 0x50 && contenido[2] == 0x4E && contenido[3] == 0x47)
        {
            return ("png", "image/png");
        }

        if (contenido.Length >= 3 &&
            contenido[0] == 0xFF && contenido[1] == 0xD8 && contenido[2] == 0xFF)
        {
            return ("jpg", "image/jpeg");
        }

        // Un .docx es un ZIP ("PK"); para no aceptar cualquier ZIP se
        // exige la parte principal de un documento de Word.
        if (contenido.Length >= 4 &&
            contenido[0] == 0x50 && contenido[1] == 0x4B && contenido[2] == 0x03 && contenido[3] == 0x04 &&
            EsDocumentoWord(contenido))
        {
            return ("docx", ContentTypeDocx);
        }

        return null;
    }

    private static bool EsDocumentoWord(byte[] contenido)
    {
        try
        {
            using var zip = new ZipArchive(new MemoryStream(contenido), ZipArchiveMode.Read);
            return zip.GetEntry("word/document.xml") is not null;
        }
        catch (InvalidDataException)
        {
            return false;
        }
    }

    private static bool EsDocumento(Panoramica panoramica) =>
        panoramica.KeyPanoramicaR2.EndsWith(".docx", StringComparison.OrdinalIgnoreCase);

    // Las imágenes se abren en el navegador; los documentos se descargan con
    // un nombre que lleva la fecha de subida (hora de Guatemala).
    private Task<string> GenerarUrlAsync(Panoramica panoramica) =>
        _r2Storage.GenerarUrlFirmadaAsync(
            panoramica.KeyPanoramicaR2,
            DuracionUrlFirmada,
            EsDocumento(panoramica)
                ? $"Documento {panoramica.FechaSubida.AddHours(-6):yyyy-MM-dd HHmm}.docx"
                : null);

    // FechaSubida se guarda en UTC. Se marca Kind=Utc para que el JSON salga con
    // sufijo "Z" y el frontend la convierta a hora de Guatemala; sin eso se mostraba
    // la hora UTC como si fuera local (6 horas adelantada).
    private static PanoramicaDto ToDto(Panoramica panoramica, string urlFirmada) => new()
    {
        Id = panoramica.IdPanoramica,
        FechaSubida = DateTime.SpecifyKind(panoramica.FechaSubida, DateTimeKind.Utc),
        UrlFirmada = urlFirmada,
        Tipo = EsDocumento(panoramica) ? PanoramicaDto.TipoDocumento : PanoramicaDto.TipoImagen,
    };
}
