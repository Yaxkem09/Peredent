namespace Peredent.Api.DTOs.Request;

// SCRUM-237: cambio del correo de la propia cuenta. Se pide la contraseña actual
// como confirmación de identidad.
public class ActualizarCorreoDto
{
    public string? Correo { get; set; }

    public string? ContrasenaActual { get; set; }
}
