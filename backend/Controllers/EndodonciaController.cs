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

        var piezas = await _db.Endodoncias
            .Where(e => e.IdPaciente == pacienteId)
            .OrderBy(e => e.Pieza)
            .ToListAsync();

        return Ok(ToDto(pacienteId, piezas));
    }

    [HttpPut("api/pacientes/{pacienteId:int}/endodoncia")]
    public async Task<ActionResult<EndodonciaDto>> Guardar(int pacienteId, [FromBody] GuardarEndodonciaDto request)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
            return NotFound(new { message = "Paciente no encontrado." });

        var existentes = await _db.Endodoncias
            .Where(e => e.IdPaciente == pacienteId)
            .ToListAsync();

        var recibidas = request.Piezas
            .GroupBy(p => p.Pieza)
            .ToDictionary(g => g.Key, g => g.Last());

        var aQuitar = existentes.Where(e => !recibidas.ContainsKey(e.Pieza)).ToList();
        _db.Endodoncias.RemoveRange(aQuitar);

        foreach (var (pieza, datos) in recibidas)
        {
            var existente = existentes.FirstOrDefault(e => e.Pieza == pieza);
            if (existente is not null)
            {
                existente.Mm1 = datos.Mm1;
                existente.Mm2 = datos.Mm2;
                existente.Mm3 = datos.Mm3;
                existente.Mm4 = datos.Mm4;
                existente.Diametro = datos.Diametro;
                existente.Cuspide = datos.Cuspide;
                existente.Obturacion = datos.Obturacion;
                existente.TxPeriodontal = request.TxPeriodontal;
                existente.ObservacionesTxPeriodontal = request.TxPeriodontal ? request.ObservacionesTxPeriodontal : null;
                existente.ObservacionesEndodoncia = request.ObservacionesEndodoncia;
            }
            else
            {
                _db.Endodoncias.Add(new Endodoncia
                {
                    IdPaciente = pacienteId,
                    Pieza = pieza,
                    Mm1 = datos.Mm1,
                    Mm2 = datos.Mm2,
                    Mm3 = datos.Mm3,
                    Mm4 = datos.Mm4,
                    Diametro = datos.Diametro,
                    Cuspide = datos.Cuspide,
                    Obturacion = datos.Obturacion,
                    TxPeriodontal = request.TxPeriodontal,
                    ObservacionesTxPeriodontal = request.TxPeriodontal ? request.ObservacionesTxPeriodontal : null,
                    ObservacionesEndodoncia = request.ObservacionesEndodoncia,
                });
            }
        }

        await _db.SaveChangesAsync();

        var resultado = await _db.Endodoncias
            .Where(e => e.IdPaciente == pacienteId)
            .OrderBy(e => e.Pieza)
            .ToListAsync();

        return Ok(ToDto(pacienteId, resultado));
    }

    private static EndodonciaDto ToDto(int pacienteId, List<Endodoncia> piezas)
    {
        var primera = piezas.FirstOrDefault();
        return new EndodonciaDto
        {
            IdPaciente = pacienteId,
            TxPeriodontal = primera?.TxPeriodontal ?? false,
            ObservacionesTxPeriodontal = primera?.ObservacionesTxPeriodontal,
            ObservacionesEndodoncia = primera?.ObservacionesEndodoncia,
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
}