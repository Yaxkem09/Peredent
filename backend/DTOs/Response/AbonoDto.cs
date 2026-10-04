namespace Peredent.Api.DTOs.Response;

// SCRUM-64: un abono con el saldo que quedó pendiente justo después de él.
public class AbonoDto
{
    public int IdAbonoPaciente { get; set; }

    public decimal Monto { get; set; }

    public DateTime Fecha { get; set; }

    // Saldo del plan después de aplicar este abono. Puede ser negativo (a favor
    // del paciente) si el plan se editó después de abonar.
    // Es null en los abonos anulados: no dejan saldo propio porque no cuentan.
    public decimal? SaldoPendiente { get; set; }

    // SCRUM-63 (anulación): el abono anulado sigue en el historial con estos datos,
    // tachado en la vista, pero no suma al abonado ni al saldo.
    public bool Anulado { get; set; }

    public DateTime? FechaAnulacion { get; set; }

    public string? MotivoAnulacion { get; set; }

    // Nombre del admin que anuló; null si el abono está vigente.
    public string? UsuarioAnulacion { get; set; }
}
