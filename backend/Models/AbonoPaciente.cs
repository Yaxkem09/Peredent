namespace Peredent.Api.Models;

// SCRUM-64: cada abono que hace el paciente contra un presupuesto de su plan de
// tratamiento (tabla dbo.AbonoPaciente de PeredentScript_Sprint4.sql).
// El saldo pendiente NO se guarda aquí: se recalcula contra el total del plan
// (SCRUM-65). Sin navegaciones a PresupuestoPlan ni a Usuario: las consultas se
// hacen por IdPresupuestoPlan / IdUsuario, como en el resto del proyecto.
public class AbonoPaciente
{
    public int IdAbonoPaciente { get; set; }

    public int IdPresupuestoPlan { get; set; }

    public int IdUsuario { get; set; }

    public decimal MontoAbono { get; set; }

    public DateTime FechaAbono { get; set; }

    // SCRUM-63 (anulación): un abono mal registrado no se borra, se anula y queda
    // tachado en el historial. Un abono anulado no cuenta para el abonado ni el
    // saldo, pero sigue apareciendo en la lista.
    public bool Anulado { get; set; }

    public DateTime? FechaAnulacion { get; set; }

    // Admin que anuló (el único rol que puede hacerlo).
    public int? IdUsuarioAnulacion { get; set; }

    public string? MotivoAnulacion { get; set; }
}
