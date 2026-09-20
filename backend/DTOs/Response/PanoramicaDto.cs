namespace Peredent.Api.DTOs.Response;

public class PanoramicaDto
{
    public int Id { get; set; }

    public DateTime FechaSubida { get; set; }

    public string UrlFirmada { get; set; } = string.Empty;
}
