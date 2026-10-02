namespace Peredent.Api.Models;

// SCRUM-254: consentimiento informado de exodoncia quirúrgica de terceros
// molares. Solo guarda los campos editables del formato; el texto fijo está
// en ConsentimientoPdfService (y en el formulario del frontend).
public class ConsentimientoExodoncia
{
    public const string EstadoBorrador = "Borrador";
    public const string EstadoImpreso = "Impreso";

    public int IdConsentimiento { get; set; }

    public int IdPaciente { get; set; }

    // Odontólogo que lo creó.
    public int IdUsuario { get; set; }

    public string NombrePaciente { get; set; } = string.Empty;

    public string DocumentoPaciente { get; set; } = string.Empty;

    public string? NombreRepresentante { get; set; }

    public string NombreDoctor { get; set; } = string.Empty;

    public string? ColegiadoDoctor { get; set; }

    public string Procedimiento { get; set; } = string.Empty;

    public string? RiesgosEspecificos { get; set; }

    public string? Observaciones { get; set; }

    public string? Lugar { get; set; }

    public DateTime FechaConsentimiento { get; set; }

    public string Estado { get; set; } = EstadoBorrador;

    public DateTime FechaCreacion { get; set; }

    public DateTime? FechaModificacion { get; set; }

    public List<ConsentimientoImpresion> Impresiones { get; set; } = new();
}
