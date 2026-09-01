namespace Peredent.Api.DTOs.Request;

public class UpdateCitaDto
{
    public int IdPaciente { get; set; }

    public int IdUsuario { get; set; }

    public DateOnly Fecha { get; set; }

    public TimeOnly Hora { get; set; }

    public string TipoTratamiento { get; set; } = string.Empty;

    public string? NotasAdicionales { get; set; }

    public bool EnviarRecordatorioWhatsApp { get; set; }

    public int IdEstadoCita { get; set; }
}
