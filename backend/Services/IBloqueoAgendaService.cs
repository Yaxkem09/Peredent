using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;

namespace Peredent.Api.Services;

public interface IBloqueoAgendaService
{
    // idUsuario filtra por odontólogo; null trae los de todos.
    Task<List<BloqueoAgendaDto>> GetByRangoAsync(DateOnly desde, DateOnly hasta, int? idUsuario = null);

    Task<BloqueoAgendaResultado> CrearAsync(int idUsuario, CreateBloqueoAgendaDto request);

    // true si existía y se borró; false si no existía o no era de ese odontólogo.
    Task<bool> EliminarAsync(int idBloqueoAgenda, int idUsuario);
}

public enum BloqueoAgendaError
{
    FechaEnElPasado,
    BloqueoDuplicado,
}

public class BloqueoAgendaResultado
{
    public bool Exitoso { get; private init; }

    public BloqueoAgendaError? Error { get; private init; }

    public string? Mensaje { get; private init; }

    public BloqueoAgendaDto? Bloqueo { get; private init; }

    public static BloqueoAgendaResultado Ok(BloqueoAgendaDto bloqueo) => new() { Exitoso = true, Bloqueo = bloqueo };

    public static BloqueoAgendaResultado Fallo(BloqueoAgendaError error, string mensaje) =>
        new() { Exitoso = false, Error = error, Mensaje = mensaje };
}
