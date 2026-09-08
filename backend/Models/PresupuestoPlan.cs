namespace Peredent.Api.Models;

public class PresupuestoPlan
{
    public int IdPresupuestoPlan { get; set; }

    public int IdPaciente { get; set; }

    public DateTime FechaInicioPlan { get; set; }

    public decimal? CantidadDescuento { get; set; }

    // NULL = plan activo (todavía se puede editar); con fecha = plan cerrado, es historial.
    public DateTime? FechaCierre { get; set; }

    public ICollection<PlanTratamiento> Piezas { get; set; } = new List<PlanTratamiento>();
}
