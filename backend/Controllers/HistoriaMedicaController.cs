using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;

namespace Peredent.Api.Controllers;

[ApiController]
public class HistoriaMedicaController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public HistoriaMedicaController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet("api/condiciones")]
    public async Task<ActionResult<IEnumerable<CondicionDto>>> GetCondiciones()
    {
        var condiciones = await _db.Condiciones.OrderBy(c => c.IdCondicion).ToListAsync();
        return Ok(condiciones.Select(ToCondicionDto));
    }

    [HttpGet("api/pacientes/{pacienteId:int}/historia-medica")]
    public async Task<ActionResult<HistoriaMedicaDto>> GetByPaciente(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var historia = await _db.HistoriasMedicas
            .Include(h => h.Condiciones)
            .FirstOrDefaultAsync(h => h.IdPaciente == pacienteId);

        var catalogo = await _db.Condiciones.OrderBy(c => c.IdCondicion).ToListAsync();

        return Ok(ToHistoriaDto(pacienteId, historia, catalogo));
    }

    [HttpPut("api/pacientes/{pacienteId:int}/historia-medica")]
    public async Task<ActionResult<HistoriaMedicaDto>> Guardar(int pacienteId, [FromBody] GuardarHistoriaMedicaDto request)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return NotFound(new { message = "Paciente no encontrado." });
        }

        var catalogo = await _db.Condiciones.OrderBy(c => c.IdCondicion).ToListAsync();
        var idsValidos = catalogo.Select(c => c.IdCondicion).ToHashSet();

        foreach (var seleccionada in request.Condiciones)
        {
            if (!idsValidos.Contains(seleccionada.IdCondicion))
            {
                return BadRequest(new { message = $"La condición con id {seleccionada.IdCondicion} no existe." });
            }
        }

        var historia = await _db.HistoriasMedicas
            .Include(h => h.Condiciones)
            .FirstOrDefaultAsync(h => h.IdPaciente == pacienteId);

        if (historia is null)
        {
            historia = new HistoriaMedica { IdPaciente = pacienteId };
            _db.HistoriasMedicas.Add(historia);
        }

        historia.ObservacionesGenerales = request.ObservacionesGenerales;

        // El payload puede repetir un IdCondicion por error del cliente; nos quedamos
        // con la ultima observacion recibida para esa condicion.
        var seleccionadas = request.Condiciones
            .GroupBy(c => c.IdCondicion)
            .ToDictionary(g => g.Key, g => g.Last().Observacion);

        // Quitar del set las condiciones que ya no vienen marcadas (evita huerfanos).
        var aQuitar = historia.Condiciones
            .Where(hc => !seleccionadas.ContainsKey(hc.IdCondicion))
            .ToList();
        foreach (var huerfana in aQuitar)
        {
            historia.Condiciones.Remove(huerfana);
            _db.HistoriasCondiciones.Remove(huerfana);
        }

        // Actualizar las que ya existian, agregar solo las que son nuevas
        // (evita el duplicado que rompe el UNIQUE(ID_HistoriaMedica, ID_Condicion)).
        foreach (var (idCondicion, observacion) in seleccionadas)
        {
            var existente = historia.Condiciones.FirstOrDefault(hc => hc.IdCondicion == idCondicion);
            if (existente is not null)
            {
                existente.ObservacionCondicion = observacion;
            }
            else
            {
                historia.Condiciones.Add(new HistoriaCondicion
                {
                    IdCondicion = idCondicion,
                    ObservacionCondicion = observacion,
                });
            }
        }

        await _db.SaveChangesAsync();

        return Ok(ToHistoriaDto(pacienteId, historia, catalogo));
    }

    private static CondicionDto ToCondicionDto(Condicion condicion) => new()
    {
        IdCondicion = condicion.IdCondicion,
        NombreCondicion = condicion.NombreCondicion,
    };

    private static HistoriaMedicaDto ToHistoriaDto(int pacienteId, HistoriaMedica? historia, List<Condicion> catalogo)
    {
        var marcadas = historia?.Condiciones.ToDictionary(hc => hc.IdCondicion, hc => hc.ObservacionCondicion)
            ?? new Dictionary<int, string?>();

        return new HistoriaMedicaDto
        {
            IdPaciente = pacienteId,
            ObservacionesGenerales = historia?.ObservacionesGenerales,
            Condiciones = catalogo.Select(c => new CondicionHistoriaDto
            {
                IdCondicion = c.IdCondicion,
                NombreCondicion = c.NombreCondicion,
                Marcada = marcadas.ContainsKey(c.IdCondicion),
                Observacion = marcadas.GetValueOrDefault(c.IdCondicion),
            }).ToList(),
        };
    }
}
