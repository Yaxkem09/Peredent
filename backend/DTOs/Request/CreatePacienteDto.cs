namespace Peredent.Api.DTOs.Request;

public class CreatePacienteDto
{
    public string Nombres { get; set; } = string.Empty;

    public string Apellidos { get; set; } = string.Empty;

    public string? Sexo { get; set; }

    public DateTime FechaNacimiento { get; set; }

    public string Telefono { get; set; } = string.Empty;

    public string? Correo { get; set; }

    // Opcional: si llega vacío se guarda como "CF" (consumidor final).
    public string? Nit { get; set; }

    public string? Direccion { get; set; }

    public string? EncargadoNombre { get; set; }

    public string? EncargadoTelefono { get; set; }
}
