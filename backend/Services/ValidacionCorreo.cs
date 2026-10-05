using System.Text.RegularExpressions;

namespace Peredent.Api.Services;

// SCRUM-237: validación del correo del usuario en un solo lugar. La usan el alta de
// usuarios (administración) y el cambio de correo de la propia cuenta, para que las
// dos acepten y rechacen exactamente lo mismo.
// Es validación de formato (algo@dominio.ext); no verifica que el correo exista.
public static class ValidacionCorreo
{
    public const int LongitudMaxima = 150;

    private static readonly Regex Formato = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

    // Se guarda en minúsculas y sin espacios para que "Ana@Correo.com" y
    // "ana@correo.com" cuenten como el mismo correo (la columna tiene índice único).
    public static string Normalizar(string correo) => correo.Trim().ToLowerInvariant();

    public static bool EsValido(string correo) =>
        !string.IsNullOrWhiteSpace(correo) && correo.Length <= LongitudMaxima && Formato.IsMatch(correo);
}
