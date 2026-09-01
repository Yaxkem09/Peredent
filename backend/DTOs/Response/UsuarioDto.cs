namespace Peredent.Api.DTOs.Response;

public class UsuarioDto
{
    public int Id { get; set; }

    public string NombreUsuario { get; set; } = string.Empty;

    public string Rol { get; set; } = string.Empty;
}
