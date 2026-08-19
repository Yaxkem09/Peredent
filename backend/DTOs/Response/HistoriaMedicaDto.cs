namespace Peredent.Api.DTOs.Response;

public class HistoriaMedicaDto
{
    public int IdPaciente { get; set; }

    public string? ObservacionesGenerales { get; set; }

    public List<CondicionHistoriaDto> Condiciones { get; set; } = new();
}

public class CondicionHistoriaDto
{
    public int IdCondicion { get; set; }

    public string NombreCondicion { get; set; } = string.Empty;

    public bool Marcada { get; set; }

    public string? Observacion { get; set; }
}
