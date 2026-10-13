namespace Peredent.Api.Models;

// SCRUM-232: token de restablecimiento de contraseña (tabla dbo.ResetPassword de
// PeredentScript_Sprint4.sql). En la base NO se guarda el token que viaja en el
// enlace: se guarda su hash SHA-256, así que leer la tabla no permite usarlo.
// Un token es de un solo uso (TokenUsado) y vence (FechaExpiracion).
public class ResetPassword
{
    public int IdTokenPassword { get; set; }

    public int IdUsuario { get; set; }

    // Hash SHA-256 en hexadecimal del token; el token real solo viaja en el correo.
    public string TokenRestablecer { get; set; } = string.Empty;

    public DateTime FechaExpiracion { get; set; }

    public bool TokenUsado { get; set; }

    public DateTime FechaCreacion { get; set; }
}
