namespace Peredent.Api.DTOs.Request;

// SCRUM-234: nueva contraseña del enlace de restablecimiento, con su confirmación.
public class RestablecerContrasenaDto
{
    public string? Token { get; set; }

    public string? NuevaContrasena { get; set; }

    public string? Confirmacion { get; set; }
}
