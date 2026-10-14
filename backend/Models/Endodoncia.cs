namespace Peredent.Api.Models;

// Medidas de endodoncia de una pieza. Tx periodontal y las observaciones
// generales están en EndodonciaPaciente.
public class Endodoncia
{
    public int IdEndodoncia { get; set; }
    public int IdPaciente { get; set; }
    public string Pieza { get; set; } = string.Empty;
    public int? Mm1 { get; set; }
    public int? Mm2 { get; set; }
    public int? Mm3 { get; set; }
    public int? Mm4 { get; set; }
    public int? Diametro { get; set; }
    public string? Cuspide { get; set; }
    public bool Obturacion { get; set; }
}
