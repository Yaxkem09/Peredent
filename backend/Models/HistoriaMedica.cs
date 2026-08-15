namespace Peredent.Api.Models;

public class HistoriaMedica
{
    public int IdHistoriaMedica { get; set; }

    public int IdPaciente { get; set; }

    public string? ObservacionesGenerales { get; set; }

    public ICollection<HistoriaCondicion> Condiciones { get; set; } = new List<HistoriaCondicion>();
}
