namespace Peredent.Api.DTOs.Response;

// Un renglón del historial cronológico de tratamientos ya realizados de un paciente
// (SCRUM-51). Solo se muestran pieza, tratamiento y fecha; el valor no forma parte
// de esta vista.
public class HistorialTratamientoDto
{
    public string Pieza { get; set; } = string.Empty;

    public string Tratamiento { get; set; } = string.Empty;

    public DateTime Fecha { get; set; }
}
