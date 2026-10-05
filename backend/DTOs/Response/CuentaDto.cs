namespace Peredent.Api.DTOs.Response;

// SCRUM-237: datos de la cuenta que se muestran (y se pueden tocar) en la pantalla
// de configuración de usuario. No hay columnas de nombre real ni teléfono, así que
// el único dato editable es el correo.
public class CuentaDto
{
    public int IdUsuario { get; set; }

    public string NombreUsuario { get; set; } = string.Empty;

    public string Rol { get; set; } = string.Empty;

    public string? Correo { get; set; }

    public bool EsAdmin { get; set; }
}
