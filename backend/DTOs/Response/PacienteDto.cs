namespace Peredent.Api.DTOs.Response;

public class PacienteDto
{
    public int Id { get; set; }

    public string Nombres { get; set; } = string.Empty;

    public string Apellidos { get; set; } = string.Empty;

    public string? Sexo { get; set; }

    public DateTime FechaNacimiento { get; set; }

    public string Telefono { get; set; } = string.Empty;

    public string? Correo { get; set; }

    public string? Direccion { get; set; }

    public string? EncargadoNombre { get; set; }

    public string? EncargadoTelefono { get; set; }

    public DateTime FechaRegistro { get; set; }
}
