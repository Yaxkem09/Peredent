namespace Peredent.Api.Models;

public class Cita
{
    public int IdCita { get; set; }

    public int IdPaciente { get; set; }

    public int IdUsuario { get; set; }

    public int IdEstadoCita { get; set; }

    public DateTime FechaInicio { get; set; }

    public DateTime FechaFin { get; set; }

    public string TipoTratamiento { get; set; } = string.Empty;

    public string? NotasAdicionales { get; set; }

    public bool EnviarRecordatorioWhatsApp { get; set; }

    public Paciente Paciente { get; set; } = null!;

    public Usuario Usuario { get; set; } = null!;

    public EstadoCita EstadoCita { get; set; } = null!;
}

public static class CitaConstantes
{
    public const int DuracionMinutos = 30;

    // Duraciones que el consultorio ofrece hoy: cita normal (30 min) o cita doble (1 hora).
    public static readonly int[] DuracionesPermitidas = { 30, 60 };

    public const int HoraAperturaClinica = 7;

    public const int HoraCierreClinica = 19;
}
