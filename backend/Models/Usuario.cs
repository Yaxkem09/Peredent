namespace Peredent.Api.Models;

public class Usuario
{
    public int IdUsuario { get; set; }

    public string NombreUsuario { get; set; } = string.Empty;

    public string Salt { get; set; } = string.Empty;

    public string ContrasenaHash { get; set; } = string.Empty;

    public int IdRol { get; set; }

    public bool Estado { get; set; }

    public DateTime? UltimoAcceso { get; set; }

    public bool EsAdmin { get; set; }

    public Rol? Rol { get; set; }
}
