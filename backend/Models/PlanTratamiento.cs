namespace Peredent.Api.Models;

public class PlanTratamiento
{
    public int IdPlanTratamiento { get; set; }

    public int IdPresupuestoPlan { get; set; }

    public int IdEstadoTratamiento { get; set; }

    public string Pieza { get; set; } = string.Empty;

    public string Tratamiento { get; set; } = string.Empty;

    public decimal Valor { get; set; }

    public DateTime FechaRegistroPlan { get; set; }

    public DateTime? FechaFinTratamiento { get; set; }

    public EstadoTratamiento EstadoTratamiento { get; set; } = null!;
}
