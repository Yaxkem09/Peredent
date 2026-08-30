namespace Peredent.Api.DTOs.Request;

public class GuardarPlanTratamientoDto
{
    public decimal Descuento { get; set; }

    public List<PiezaPlanDto> Piezas { get; set; } = new();
}

public class PiezaPlanDto
{
    public string Pieza { get; set; } = string.Empty;

    public string? Tratamiento { get; set; }

    public decimal Valor { get; set; }
}
