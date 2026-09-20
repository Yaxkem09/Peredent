namespace Peredent.Api.DTOs.Response;

// SCRUM-92: receta médica tal como se muestra/descarga en el expediente. El
// odontólogo va como instantánea (ver Models/DatosRecetario.cs), no como
// referencia al perfil actual del usuario.
public class RecetaDto
{
    public int IdReceta { get; set; }

    public int IdPaciente { get; set; }

    public string NombrePaciente { get; set; } = string.Empty;

    public DateTime FechaEmision { get; set; }

    public string? NotasAdicionales { get; set; }

    public DatosOdontologoRespuestaDto Odontologo { get; set; } = new();

    public List<MedicamentoRecetaRespuestaDto> Medicamentos { get; set; } = new();
}

public class DatosOdontologoRespuestaDto
{
    public string Nombres { get; set; } = string.Empty;

    public string Apellidos { get; set; } = string.Empty;

    public string Colegiado { get; set; } = string.Empty;

    public string Direccion { get; set; } = string.Empty;

    public string Telefono { get; set; } = string.Empty;

    public string Correo { get; set; } = string.Empty;
}

public class MedicamentoRecetaRespuestaDto
{
    public string Nombre { get; set; } = string.Empty;

    public string Presentacion { get; set; } = string.Empty;

    public string Indicaciones { get; set; } = string.Empty;
}
