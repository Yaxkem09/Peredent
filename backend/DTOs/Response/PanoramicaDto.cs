namespace Peredent.Api.DTOs.Response;

public class PanoramicaDto
{
    public const string TipoImagen = "imagen";
    public const string TipoDocumento = "documento";

    public int Id { get; set; }

    public DateTime FechaSubida { get; set; }

    public string UrlFirmada { get; set; } = string.Empty;

    // "imagen" (JPG/PNG, se ve en la galería) o "documento" (Word .docx, se
    // descarga).
    public string Tipo { get; set; } = TipoImagen;
}
