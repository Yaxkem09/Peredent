namespace Peredent.Api.DTOs.Request;

// SCRUM-254/257: campos editables del consentimiento de exodoncia. Se usa
// tanto para crear como para editar. Obligatorios (SCRUM-259): nombre del
// paciente, documento, doctor, procedimiento y fecha.
public class GuardarConsentimientoDto
{
    public string? NombrePaciente { get; set; }

    public string? DocumentoPaciente { get; set; }

    public string? NombreRepresentante { get; set; }

    public string? NombreDoctor { get; set; }

    public string? ColegiadoDoctor { get; set; }

    public string? Procedimiento { get; set; }

    public string? RiesgosEspecificos { get; set; }

    public string? Observaciones { get; set; }

    public string? Lugar { get; set; }

    public DateTime? FechaConsentimiento { get; set; }
}
