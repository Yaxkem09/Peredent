namespace Peredent.Api.DTOs.Response;

// SCRUM-77: documento de presupuesto que el paciente revisa y firma antes de
// iniciar el tratamiento. No se guarda como copia: se arma en cada consulta a
// partir del plan de tratamiento activo del paciente, de modo que siempre
// refleja el plan actual (SCRUM-205). Si no hay plan activo (nunca tuvo uno,
// o el último ya se finalizó) no se muestra ningún plan viejo: TienePlan sale
// en false y el frontend muestra el estado vacío.
public class PresupuestoDto
{
    public int IdPaciente { get; set; }

    public string NombrePaciente { get; set; } = string.Empty;

    // Fecha en que se genera/consulta el presupuesto (hoy, hora de Guatemala).
    public DateTime FechaEmision { get; set; }

    // Fecha de inicio del plan activo que este presupuesto refleja; null si el
    // paciente no tiene un plan de tratamiento activo.
    public DateTime? FechaPlan { get; set; }

    // false cuando el paciente no tiene un plan de tratamiento activo con
    // piezas: el frontend muestra un estado vacío en vez de una tabla sin
    // renglones o el detalle de un plan ya finalizado.
    public bool TienePlan { get; set; }

    public List<PresupuestoLineaDto> Detalle { get; set; } = new();

    public decimal Subtotal { get; set; }

    public decimal Descuento { get; set; }

    public decimal Total { get; set; }

    // SCRUM-80: leyenda de conformidad que se muestra tanto en la vista como en
    // el PDF. La fija el controller para tener una única fuente del texto.
    public string LeyendaConformidad { get; set; } = string.Empty;
}

public class PresupuestoLineaDto
{
    public string Pieza { get; set; } = string.Empty;

    public string Tratamiento { get; set; } = string.Empty;

    public decimal Valor { get; set; }
}
