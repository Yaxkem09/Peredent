namespace Peredent.Api.DTOs.Request;

public class CrearRecetaDto
{
    public DatosOdontologoDto Odontologo { get; set; } = new();

    public List<MedicamentoRecetaDto> Medicamentos { get; set; } = new();

    public string? NotasAdicionales { get; set; }
}

public class DatosOdontologoDto
{
    public string Nombres { get; set; } = string.Empty;

    public string Apellidos { get; set; } = string.Empty;

    public string Colegiado { get; set; } = string.Empty;

    public string Direccion { get; set; } = string.Empty;

    public string Telefono { get; set; } = string.Empty;

    public string Correo { get; set; } = string.Empty;
}

public class MedicamentoRecetaDto
{
    public string Nombre { get; set; } = string.Empty;

    public string Presentacion { get; set; } = string.Empty;

    public string Indicaciones { get; set; } = string.Empty;
}
