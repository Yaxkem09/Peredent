namespace Peredent.Api.DTOs.Request;

// Cambio del nombre de usuario de la propia cuenta. Se pide la contraseña actual
// como confirmación de identidad.
public class ActualizarUsuarioDto
{
    public string? NombreUsuario { get; set; }

    public string? ContrasenaActual { get; set; }
}
