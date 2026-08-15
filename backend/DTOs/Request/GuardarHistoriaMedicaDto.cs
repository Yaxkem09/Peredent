namespace Peredent.Api.DTOs.Request;

public class GuardarHistoriaMedicaDto
{
    public string? ObservacionesGenerales { get; set; }

    public List<CondicionSeleccionadaDto> Condiciones { get; set; } = new();
}

public class CondicionSeleccionadaDto
{
    public int IdCondicion { get; set; }

    public string? Observacion { get; set; }
}
