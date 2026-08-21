namespace Peredent.Api.Models;

public class HistoriaCondicion
{
    public int IdHistoriaCondicion { get; set; }

    public int IdHistoriaMedica { get; set; }

    public int IdCondicion { get; set; }

    public string? ObservacionCondicion { get; set; }

    public Condicion Condicion { get; set; } = null!;
}
