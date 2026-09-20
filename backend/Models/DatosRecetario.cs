namespace Peredent.Api.Models;

// SCRUM-93: datos del odontólogo/clínica que encabezan una receta. Es una
// instantánea "quemada" en el momento de emitir la receta (no un perfil que
// se sobrescribe): cada receta guarda su propia fila, así que si el
// odontólogo cambia de dirección o teléfono más adelante, las recetas ya
// emitidas conservan los datos que eran ciertos cuando se generaron.
public class DatosRecetario
{
    public int IdDatosRecetario { get; set; }

    public int IdUsuario { get; set; }

    public string NombresOdontologo { get; set; } = string.Empty;

    public string ApellidosOdontologo { get; set; } = string.Empty;

    public string ColegiadoOdontologo { get; set; } = string.Empty;

    public string DireccionOdontologo { get; set; } = string.Empty;

    public string TelefonoOdontologo { get; set; } = string.Empty;

    public string CorreoOdontologo { get; set; } = string.Empty;

    // Key del archivo de firma en Cloudflare R2 (SCRUM-173/180). Todavía no hay
    // flujo para subirla, así que queda nula hasta que exista esa integración.
    public string? FirmaKeyR2 { get; set; }
}
