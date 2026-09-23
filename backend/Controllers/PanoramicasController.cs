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

        if (!archivo.ContentType.Equals("image/png", StringComparison.OrdinalIgnoreCase) &&
            !archivo.ContentType.Equals("image/jpeg", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Solo se permiten archivos JPG o PNG." });
        }

        using var contenido = new MemoryStream();
        await archivo.CopyToAsync(contenido);
        var bytes = contenido.ToArray();

        // El Content-Type declarado lo controla el cliente y puede mentir; tanto
        // la extensión como el Content-Type real que se sube a R2 se deciden
        // por los magic bytes, no por lo que dijo el cliente.
        var tipoDetectado = DetectarTipoPorMagicBytes(bytes);
        if (tipoDetectado is null)
        {
            return BadRequest(new { message = "El contenido del archivo no corresponde a una imagen JPG o PNG válida." });
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

        var urlFirmada = await _r2Storage.GenerarUrlFirmadaAsync(objectKey, DuracionUrlFirmada);

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
            var urlFirmada = await _r2Storage.GenerarUrlFirmadaAsync(panoramica.KeyPanoramicaR2, DuracionUrlFirmada);
            dtos.Add(ToDto(panoramica, urlFirmada));
        }

        return Ok(dtos);
    }

    [HttpDelete("{id:int}")]
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

        return null;
    }

    private static PanoramicaDto ToDto(Panoramica panoramica, string urlFirmada) => new()
    {
        Id = panoramica.IdPanoramica,
        FechaSubida = panoramica.FechaSubida,
        UrlFirmada = urlFirmada,
    };
}
