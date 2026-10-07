namespace Peredent.Api.DTOs.Request;

// SCRUM-231: la pantalla de "¿Olvidaste tu contraseña?" pide el correo de la cuenta.
public class OlvideContrasenaDto
{
    public string? Identificador { get; set; }
}
