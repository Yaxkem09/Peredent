namespace Peredent.Api.DTOs.Response;

public class CitaDto
{
    public int IdCita { get; set; }

    public int IdPaciente { get; set; }

    public string NombrePaciente { get; set; } = string.Empty;

    public int IdUsuario { get; set; }

    public string NombreOdontologo { get; set; } = string.Empty;

    public DateOnly Fecha { get; set; }

    public TimeOnly Hora { get; set; }

    public int DuracionMinutos { get; set; }

    public string TipoTratamiento { get; set; } = string.Empty;

    public string? NotasAdicionales { get; set; }

    public bool EnviarRecordatorioWhatsApp { get; set; }

    public int IdEstadoCita { get; set; }

    public string Estado { get; set; } = string.Empty;
}

public class EstadoCitaDto
{
    public int Id { get; set; }

    public string Nombre { get; set; } = string.Empty;
}
