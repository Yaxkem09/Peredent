namespace Peredent.Api.DTOs.Request;

public class GuardarEndodonciaDto
{
    public bool TxPeriodontal { get; set; }
    public string? ObservacionesTxPeriodontal { get; set; }
    public string? ObservacionesEndodoncia { get; set; }
    public List<PiezaEndodonciaDto> Piezas { get; set; } = new();
}

public class PiezaEndodonciaDto
{
    public string Pieza { get; set; } = string.Empty;
    public int? Mm1 { get; set; }
    public int? Mm2 { get; set; }
    public int? Mm3 { get; set; }
    public int? Mm4 { get; set; }
    public int? Diametro { get; set; }
    public string? Cuspide { get; set; }
    public bool Obturacion { get; set; }
}