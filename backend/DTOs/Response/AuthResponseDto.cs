namespace Peredent.Api.DTOs.Response;

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;

    public string Usuario { get; set; } = string.Empty;

    public string Rol { get; set; } = string.Empty;

    public bool EsAdmin { get; set; }
}
