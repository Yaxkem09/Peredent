namespace Peredent.Api.DTOs.Response;

// SCRUM-66: estado de cuenta completo del paciente. Reúne TODOS sus planes de
// tratamiento (el activo primero y después los cerrados) con sus totales y su
// historial de abonos, más un resumen general.
public class EstadoCuentaPacienteDto
{
    public int IdPaciente { get; set; }

    public string NombrePaciente { get; set; } = string.Empty;

    // false cuando el paciente no tiene ningún plan (ni activo ni cerrado): el
    // frontend muestra el estado vacío "sin plan".
    public bool TienePlanes { get; set; }

    // Id del plan activo (FechaCierre NULL); null si ya no tiene ninguno abierto.
    // Solo sobre el plan activo se pueden registrar o anular abonos.
    public int? IdPlanActivo { get; set; }

    public ResumenEstadoCuentaDto Resumen { get; set; } = new();

    // Plan activo primero; los cerrados del más reciente al más antiguo.
    public List<EstadoCuentaPlanDto> Planes { get; set; } = new();
}

// Totales de todos los planes juntos. Un plan cerrado con saldo pendiente sigue
// siendo deuda del paciente, por eso se suma al resumen general.
public class ResumenEstadoCuentaDto
{
    public int TotalPlanes { get; set; }

    public decimal TotalTratamientos { get; set; }

    public decimal TotalAbonado { get; set; }

    public decimal SaldoPendiente { get; set; }
}
