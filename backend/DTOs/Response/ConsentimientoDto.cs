namespace Peredent.Api.DTOs.Response;

// SCRUM-254: consentimiento de exodoncia tal como se lista/edita en el
// expediente y se pasa al generador del PDF.
public class ConsentimientoDto
{
    public int IdConsentimiento { get; set; }

    public int IdPaciente { get; set; }

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

    public string Estado { get; set; } = string.Empty;

    public DateTime FechaCreacion { get; set; }

    public DateTime? FechaModificacion { get; set; }

    // SCRUM-263/264: historial de impresiones, la más reciente primero.
    public List<ConsentimientoImpresionDto> Impresiones { get; set; } = new();
}

public class ConsentimientoImpresionDto
{
    public DateTime FechaImpresion { get; set; }

    public string Usuario { get; set; } = string.Empty;
}
