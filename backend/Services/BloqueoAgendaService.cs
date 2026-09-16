using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;

namespace Peredent.Api.Services;

public class BloqueoAgendaService : IBloqueoAgendaService
{
    private readonly ApplicationDbContext _db;

    public BloqueoAgendaService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<List<BloqueoAgendaDto>> GetByRangoAsync(DateOnly desde, DateOnly hasta, int? idUsuario = null)
    {
        var bloqueos = await _db.BloqueosAgenda
            .Include(b => b.Usuario)
            .Where(b => b.Fecha >= desde && b.Fecha <= hasta)
            .Where(b => idUsuario == null || b.IdUsuario == idUsuario)
            .OrderBy(b => b.Fecha)
            .ToListAsync();

        return bloqueos.Select(ToDto).ToList();
    }

    public async Task<BloqueoAgendaResultado> CrearAsync(int idUsuario, CreateBloqueoAgendaDto request)
    {
        if (request.Fecha < DateOnly.FromDateTime(AhoraGuatemala()))
        {
            return BloqueoAgendaResultado.Fallo(BloqueoAgendaError.FechaEnElPasado, "No se puede bloquear una fecha ya pasada.");
        }

        var yaExiste = await _db.BloqueosAgenda.AnyAsync(b => b.IdUsuario == idUsuario && b.Fecha == request.Fecha);
        if (yaExiste)
        {
            return BloqueoAgendaResultado.Fallo(BloqueoAgendaError.BloqueoDuplicado, "Ese día ya está marcado como no laborable.");
        }

        var bloqueo = new BloqueoAgenda
        {
            IdUsuario = idUsuario,
            Fecha = request.Fecha,
            Motivo = string.IsNullOrWhiteSpace(request.Motivo) ? null : request.Motivo.Trim(),
            CreadoEn = AhoraGuatemala(),
        };

        _db.BloqueosAgenda.Add(bloqueo);
        await _db.SaveChangesAsync();

        var creado = await _db.BloqueosAgenda
            .Include(b => b.Usuario)
            .FirstAsync(b => b.IdBloqueoAgenda == bloqueo.IdBloqueoAgenda);

        return BloqueoAgendaResultado.Ok(ToDto(creado));
    }

    public async Task<bool> EliminarAsync(int idBloqueoAgenda, int idUsuario)
    {
        // Scoped al propio idUsuario: un odontólogo solo puede borrar sus
        // propios bloqueos, nunca los de otro.
        var bloqueo = await _db.BloqueosAgenda
            .FirstOrDefaultAsync(b => b.IdBloqueoAgenda == idBloqueoAgenda && b.IdUsuario == idUsuario);

        if (bloqueo is null)
        {
            return false;
        }

        _db.BloqueosAgenda.Remove(bloqueo);
        await _db.SaveChangesAsync();
        return true;
    }

    // Misma referencia horaria que CitaService: Guatemala es UTC-6 todo el
    // año (sin horario de verano).
    private static DateTime AhoraGuatemala() => DateTime.UtcNow.AddHours(-6);

    private static BloqueoAgendaDto ToDto(BloqueoAgenda b) => new()
    {
        IdBloqueoAgenda = b.IdBloqueoAgenda,
        IdUsuario = b.IdUsuario,
        NombreOdontologo = b.Usuario.NombreUsuario,
        Fecha = b.Fecha,
        Motivo = b.Motivo,
    };
}
