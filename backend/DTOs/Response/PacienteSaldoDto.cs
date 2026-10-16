namespace Peredent.Api.DTOs.Response;

// Dashboard del odontólogo: saldos pendientes por cobrar. Los totales son de
// todos los pacientes que deben, aunque la lista venga recortada al top 10.
public class SaldosPendientesDto
{
    public int TotalPacientes { get; set; }

    public decimal TotalPorCobrar { get; set; }

    // De mayor a menor saldo.
    public List<PacienteSaldoDto> Pacientes { get; set; } = new();
}

// Un paciente con saldo pendiente.
public class PacienteSaldoDto
{
    public int IdPaciente { get; set; }

    public string NombrePaciente { get; set; } = string.Empty;

    public string? Telefono { get; set; }

    // Suma de los saldos pendientes de sus planes (solo los que deben; un plan
    // con saldo a favor no le resta a otro).
    public decimal SaldoPendiente { get; set; }

    public int PlanesConSaldo { get; set; }
}
