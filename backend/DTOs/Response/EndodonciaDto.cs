namespace Peredent.Api.DTOs.Response;

public class EndodonciaDto
{
    public int IdPaciente { get; set; }
    public bool TxPeriodontal { get; set; }
    public string? ObservacionesTxPeriodontal { get; set; }
    public string? ObservacionesEndodoncia { get; set; }
    public List<PiezaEndodonciaRespuestaDto> Piezas { get; set; } = new();
}

public class PiezaEndodonciaRespuestaDto
{
    public int IdEndodoncia { get; set; }
    public string Pieza { get; set; } = string.Empty;
    public int? Mm1 { get; set; }
    public int? Mm2 { get; set; }
    public int? Mm3 { get; set; }
    public int? Mm4 { get; set; }
    public int? Diametro { get; set; }
    public string? Cuspide { get; set; }
    public bool Obturacion { get; set; }
}