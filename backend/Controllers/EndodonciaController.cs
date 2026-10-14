using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;

namespace Peredent.Api.Controllers;

[ApiController]
[Authorize]
public class EndodonciaController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public EndodonciaController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet("api/pacientes/{pacienteId:int}/endodoncia")]
    public async Task<ActionResult<EndodonciaDto>> GetByPaciente(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
            return NotFound(new { message = "Paciente no encontrado." });

        return Ok(await CargarDtoAsync(pacienteId));
    }

    [HttpPut("api/pacientes/{pacienteId:int}/endodoncia")]
    public async Task<ActionResult<EndodonciaDto>> Guardar(int pacienteId, [FromBody] GuardarEndodonciaDto request)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
            return NotFound(new { message = "Paciente no encontrado." });

        // Datos generales (Tx periodontal y observaciones): se guardan aparte
        // de las piezas, así se pueden registrar aunque no haya ninguna.
        var general = await _db.EndodonciasPaciente.FindAsync(pacienteId);
        if (general is null)
        {
            general = new EndodonciaPaciente { IdPaciente = pacienteId };
            _db.EndodonciasPaciente.Add(general);
        }
        general.TxPeriodontal = request.TxPeriodontal;
        general.ObservacionesTxPeriodontal = request.TxPeriodontal ? Opcional(request.ObservacionesTxPeriodontal) : null;
        general.ObservacionesEndodoncia = Opcional(request.ObservacionesEndodoncia);

        var existentes = await _db.Endodoncias
            .Where(e => e.IdPaciente == pacienteId)
            .ToListAsync();

        // Filas sin pieza seleccionada se ignoran en lugar de guardarse vacías.
        var recibidas = request.Piezas
            .Where(p => !string.IsNullOrWhiteSpace(p.Pieza))
            .GroupBy(p => p.Pieza.Trim())
            .ToDictionary(g => g.Key, g => g.Last());

        var aQuitar = existentes.Where(e => !recibidas.ContainsKey(e.Pieza)).ToList();
        _db.Endodoncias.RemoveRange(aQuitar);

        foreach (var (pieza, datos) in recibidas)
        {
            var existente = existentes.FirstOrDefault(e => e.Pieza == pieza);
            if (existente is null)
            {
                existente = new Endodoncia { IdPaciente = pacienteId, Pieza = pieza };
                _db.Endodoncias.Add(existente);
            }

            existente.Mm1 = datos.Mm1;
            existente.Mm2 = datos.Mm2;
            existente.Mm3 = datos.Mm3;
            existente.Mm4 = datos.Mm4;
            existente.Diametro = datos.Diametro;
            existente.Cuspide = datos.Cuspide;
            existente.Obturacion = datos.Obturacion;
        }

        await _db.SaveChangesAsync();

        return Ok(await CargarDtoAsync(pacienteId));
    }

    private async Task<EndodonciaDto> CargarDtoAsync(int pacienteId)
    {
        var general = await _db.EndodonciasPaciente
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.IdPaciente == pacienteId);

        var piezas = await _db.Endodoncias
            .AsNoTracking()
            .Where(e => e.IdPaciente == pacienteId)
            .OrderBy(e => e.Pieza)
            .ToListAsync();

        return new EndodonciaDto
        {
            IdPaciente = pacienteId,
            TxPeriodontal = general?.TxPeriodontal ?? false,
            ObservacionesTxPeriodontal = general?.ObservacionesTxPeriodontal,
            ObservacionesEndodoncia = general?.ObservacionesEndodoncia,
            Piezas = piezas.Select(e => new PiezaEndodonciaRespuestaDto
            {
                IdEndodoncia = e.IdEndodoncia,
                Pieza = e.Pieza,
                Mm1 = e.Mm1,
                Mm2 = e.Mm2,
                Mm3 = e.Mm3,
                Mm4 = e.Mm4,
                Diametro = e.Diametro,
                Cuspide = e.Cuspide,
                Obturacion = e.Obturacion,
            }).ToList(),
        };
    }

    private static string? Opcional(string? valor) =>
        string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
}
