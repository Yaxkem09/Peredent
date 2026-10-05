namespace Peredent.Api.DTOs.Request;

// SCRUM-231: la pantalla de "¿Olvidaste tu contraseña?" pide correo o usuario.
public class OlvideContrasenaDto
{
    public string? Identificador { get; set; }
}
