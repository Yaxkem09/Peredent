namespace Peredent.Api.Models;

public class Panoramica
{
    public int IdPanoramica { get; set; }

    public int IdPaciente { get; set; }

    public string KeyPanoramicaR2 { get; set; } = string.Empty;

    public DateTime FechaSubida { get; set; }

    public DateTime? FechaEliminacion { get; set; }

    public Paciente Paciente { get; set; } = null!;
}
