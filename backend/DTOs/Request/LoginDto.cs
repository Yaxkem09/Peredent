namespace Peredent.Api.DTOs.Request;

public class LoginDto
{
    // Solo se entra con el correo (ya no con el nombre de usuario).
    public string Correo { get; set; } = string.Empty;

    public string Clave { get; set; } = string.Empty;
}
