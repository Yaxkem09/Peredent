namespace Peredent.Api.DTOs.Response;

// SCRUM-234: si el token del enlace sirve, la pantalla muestra el formulario de
// contraseña nueva; si no, el mensaje de enlace inválido o expirado.
public class TokenValidadoDto
{
    public bool Valido { get; set; }
}
