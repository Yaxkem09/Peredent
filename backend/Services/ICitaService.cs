using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;

namespace Peredent.Api.Services;

public interface ICitaService
{
    Task<List<CitaDto>> GetByRangoAsync(DateOnly desde, DateOnly hasta);

    Task<List<EstadoCitaDto>> GetEstadosAsync();

    Task<CitaDto?> GetByIdAsync(int idCita);

    Task<CitaResultado> CrearAsync(CreateCitaDto request);

    Task<CitaResultado> ActualizarAsync(int idCita, UpdateCitaDto request);

    Task<CitaResultado> CancelarAsync(int idCita);
}

public enum CitaError
{
    CitaNoEncontrada,
    PacienteNoEncontrado,
    DentistaNoEncontrado,
    EstadoInvalido,
    DuracionInvalida,
    FueraDeHorarioAtencion,
    ConflictoHorario,
    FechaEnElPasado,
    EstadoNoDisponibleAun,
}

// Resultado explícito en vez de excepciones: así el controller puede distinguir,
// por ejemplo, un conflicto de horario (400) de un paciente inexistente (404)
// sin depender de parsear mensajes ni de tipos de excepción.
public class CitaResultado
{
    public bool Exitoso { get; private init; }

    public CitaError? Error { get; private init; }

    public string? Mensaje { get; private init; }

    public CitaDto? Cita { get; private init; }

    public static CitaResultado Ok(CitaDto cita) => new() { Exitoso = true, Cita = cita };

    public static CitaResultado Fallo(CitaError error, string mensaje) =>
        new() { Exitoso = false, Error = error, Mensaje = mensaje };
}
