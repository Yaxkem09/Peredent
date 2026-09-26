namespace Peredent.Api.Models;

public class Cita
{
    public int IdCita { get; set; }

    public int IdPaciente { get; set; }

    public int IdUsuario { get; set; }

    public int IdEstadoCita { get; set; }

    public DateTime FechaInicio { get; set; }

    public DateTime FechaFin { get; set; }

    public string? NotasAdicionales { get; set; }

    public Paciente Paciente { get; set; } = null!;

    public Usuario Usuario { get; set; } = null!;

    public EstadoCita EstadoCita { get; set; } = null!;
}

public static class CitaConstantes
{
    public const int DuracionMinutos = 30;

    // La agenda trabaja en bloques de 15 minutos: tanto al crear una cita con
    // hora de inicio/fin como al estirarla o moverla arrastrando en el
    // calendario, la duración siempre es un múltiplo de este incremento.
    public const int IncrementoMinutos = 15;

    public const int HoraAperturaClinica = 7;

    public const int HoraCierreClinica = 19;
}
