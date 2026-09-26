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

    // Nullable a propósito: este DTO también lo usa el PUT, y un cliente que no
    // envíe el campo no debe revocar el consentimiento sin querer. En create,
    // null => false; en update, null => se conserva el valor actual.
    public bool? AceptaRecordatoriosWhatsApp { get; set; }
}
