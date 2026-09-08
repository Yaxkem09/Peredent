namespace Peredent.Api.DTOs.Response;

public class PlanTratamientoDto
{
    public int IdPresupuestoPlan { get; set; }

    public int IdPaciente { get; set; }

    public DateTime? FechaInicio { get; set; }

    public DateTime? FechaCierre { get; set; }

    public decimal Descuento { get; set; }

    public decimal Subtotal { get; set; }

    public decimal Total { get; set; }

    public List<PiezaPlanRespuestaDto> Piezas { get; set; } = new();
}

public class PiezaPlanRespuestaDto
{
    public string Pieza { get; set; } = string.Empty;

    public string Tratamiento { get; set; } = string.Empty;

    public decimal Valor { get; set; }

    public string Estado { get; set; } = string.Empty;
}
