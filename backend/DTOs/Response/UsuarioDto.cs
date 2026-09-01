namespace Peredent.Api.DTOs.Response;

public class UsuarioDto
{
    public int Id { get; set; }

    public string NombreUsuario { get; set; } = string.Empty;

    public int IdRol { get; set; }

    public string Rol { get; set; } = string.Empty;

    public bool Estado { get; set; }

    public bool EsAdmin { get; set; }

    public DateTime? UltimoAcceso { get; set; }
}
