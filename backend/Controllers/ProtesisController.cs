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
public class ProtesisController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public ProtesisController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet("api/pacientes/{pacienteId:int}/protesis")]
    public async Task<ActionResult<ProtesisDto>> GetByPaciente(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
            return NotFound(new { message = "Paciente no encontrado." });

        var protesis = await _db.Protesis
            .FirstOrDefaultAsync(p => p.IdPaciente == pacienteId);

        return Ok(ToDto(pacienteId, protesis));
    }

    [HttpPut("api/pacientes/{pacienteId:int}/protesis")]
    public async Task<ActionResult<ProtesisDto>> Guardar(int pacienteId, [FromBody] GuardarProtesisDto request)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
            return NotFound(new { message = "Paciente no encontrado." });

        var existente = await _db.Protesis
            .FirstOrDefaultAsync(p => p.IdPaciente == pacienteId);

        if (existente is not null)
        {
            existente.PPF = request.PPF;
            existente.PPRSup = request.PPRSup;
            existente.PPRInf = request.PPRInf;
            existente.PTSup = request.PTSup;
            existente.PTInf = request.PTInf;
            existente.ObservacionesProtesis = request.ObservacionesProtesis;
        }
        else
        {
            _db.Protesis.Add(new Protesis
            {
                IdPaciente = pacienteId,
                PPF = request.PPF,
                PPRSup = request.PPRSup,
                PPRInf = request.PPRInf,
                PTSup = request.PTSup,
                PTInf = request.PTInf,
                ObservacionesProtesis = request.ObservacionesProtesis,
            });
        }

        await _db.SaveChangesAsync();

        var resultado = await _db.Protesis
            .FirstOrDefaultAsync(p => p.IdPaciente == pacienteId);

        return Ok(ToDto(pacienteId, resultado));
    }

    private static ProtesisDto ToDto(int pacienteId, Protesis? p) => new()
    {
        IdPaciente = pacienteId,
        PPF = p?.PPF ?? false,
        PPRSup = p?.PPRSup ?? false,
        PPRInf = p?.PPRInf ?? false,
        PTSup = p?.PTSup ?? false,
        PTInf = p?.PTInf ?? false,
        ObservacionesProtesis = p?.ObservacionesProtesis,
    };
}