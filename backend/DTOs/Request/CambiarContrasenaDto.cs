namespace Peredent.Api.DTOs.Request;

// SCRUM-238: cambio de la propia contraseña con actual, nueva y confirmación.
public class CambiarContrasenaDto
{
    public string? ContrasenaActual { get; set; }

    public string? NuevaContrasena { get; set; }

    public string? Confirmacion { get; set; }
}
