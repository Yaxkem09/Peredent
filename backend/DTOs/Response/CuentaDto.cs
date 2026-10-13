namespace Peredent.Api.DTOs.Response;

// SCRUM-237: datos de la cuenta que se muestran (y se pueden tocar) en la pantalla
// de configuración de usuario. No hay columnas de nombre real ni teléfono: lo
// editable es el nombre de usuario y el correo.
public class CuentaDto
{
    public int IdUsuario { get; set; }

    public string NombreUsuario { get; set; } = string.Empty;

    public string Rol { get; set; } = string.Empty;

    public string? Correo { get; set; }

    public bool EsAdmin { get; set; }

    // Solo viene al cambiar el nombre de usuario: el token lleva el nombre como
    // claim, así que se emite uno nuevo para que la sesión siga coherente.
    public string? Token { get; set; }
}
