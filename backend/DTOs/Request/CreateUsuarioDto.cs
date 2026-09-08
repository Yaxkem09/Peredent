namespace Peredent.Api.DTOs.Request;

public class CreateUsuarioDto
{
    public string NombreUsuario { get; set; } = string.Empty;

    public string Clave { get; set; } = string.Empty;

    public int IdRol { get; set; }

    public bool EsAdmin { get; set; }
}
