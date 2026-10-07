namespace Peredent.Api.DTOs.Request;

// SCRUM-234: validación del token que viene en el enlace del correo.
public class ValidarTokenDto
{
    public string? Token { get; set; }
}
