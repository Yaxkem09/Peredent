namespace Peredent.Api.DTOs.Response;

// Estado de cuenta de un presupuesto: los totales del plan, cuánto se ha abonado
// y el historial de abonos con el saldo que quedó tras cada uno.
// TienePlan=false (SCRUM-66, primera parte) es el estado vacío del plan activo:
// el paciente todavía no tiene plan, así que no hay nada que abonar. Se usa el
// mismo criterio que PresupuestoDto.TienePlan (SCRUM-77) para que el frontend
// muestre el estado vacío en vez de un error.
public class EstadoCuentaPlanDto
{
    public bool TienePlan { get; set; }

    public int IdPresupuestoPlan { get; set; }

    public int IdPaciente { get; set; }

    public DateTime? FechaInicio { get; set; }

    public DateTime? FechaCierre { get; set; }

    // true mientras el plan siga activo (FechaCierre NULL); los cerrados son
    // solo lectura y pasan al historial.
    public bool Activo { get; set; }

    public decimal Subtotal { get; set; }

    public decimal Descuento { get; set; }

    public decimal Total { get; set; }

    public decimal Abonado { get; set; }

    public decimal Saldo { get; set; }

    // Del abono más reciente al más antiguo.
    public List<AbonoDto> Abonos { get; set; } = new();
}
