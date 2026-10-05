namespace Peredent.Api.Services;

// SCRUM-235 / SCRUM-239: política de contraseñas en un solo lugar, para que
// restablecer la contraseña (SCRUM-234) y cambiarla desde configuración
// (SCRUM-238) validen exactamente lo mismo.
// No se aplica al login: un usuario con contraseña vieja tiene que poder entrar
// para que el login le migre el hash a bcrypt.
public static class PoliticaContrasena
{
    public const int LongitudMinima = 8;
    public const int LongitudMaxima = 128;

    // Devuelve el mensaje en español del primer requisito que no se cumple, o null
    // si la contraseña es válida.
    public static string? Validar(string? clave)
    {
        if (string.IsNullOrEmpty(clave))
        {
            return "La contraseña es obligatoria.";
        }

        if (clave.Length < LongitudMinima)
        {
            return $"La contraseña debe tener al menos {LongitudMinima} caracteres.";
        }

        if (clave.Length > LongitudMaxima)
        {
            return $"La contraseña no puede tener más de {LongitudMaxima} caracteres.";
        }

        if (!clave.Any(char.IsUpper))
        {
            return "La contraseña debe incluir al menos una letra mayúscula.";
        }

        if (!clave.Any(char.IsLower))
        {
            return "La contraseña debe incluir al menos una letra minúscula.";
        }

        if (!clave.Any(char.IsDigit))
        {
            return "La contraseña debe incluir al menos un número.";
        }

        return null;
    }
}
