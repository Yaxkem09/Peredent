using Peredent.Api.DTOs.Response;

namespace Peredent.Api.Services;

public interface IPlanTratamientoService
{
    Task<PlanTratamientoResultado> ObtenerPendientesPorPacienteAsync(int pacienteId);

    Task<PlanTratamientoResultado> MarcarComoCompletadoAsync(int pacienteId, string pieza);
}

public enum PlanTratamientoError
{
    PacienteNoEncontrado,
    PlanActivoNoEncontrado,
    PiezaNoEncontrada,
    CatalogoEstadosNoSembrado,
}

// Resultado explícito en vez de excepciones: así el controller puede distinguir,
// por ejemplo, una pieza inexistente (404) de un catálogo sin sembrar (500) sin
// depender de parsear mensajes ni de tipos de excepción (mismo patrón que CitaResultado).
public class PlanTratamientoResultado
{
    public bool Exitoso { get; private init; }

    public PlanTratamientoError? Error { get; private init; }

    public string? Mensaje { get; private init; }

    public List<TratamientoPendienteDto>? Pendientes { get; private init; }

    public static PlanTratamientoResultado Ok(List<TratamientoPendienteDto> pendientes) =>
        new() { Exitoso = true, Pendientes = pendientes };

    public static PlanTratamientoResultado Fallo(PlanTratamientoError error, string mensaje) =>
        new() { Exitoso = false, Error = error, Mensaje = mensaje };
}
