using System.Security.Cryptography;
using System.Text;

namespace Peredent.Api.Helpers;

public static class ComparacionSegura
{
    // Compara dos secretos (API key, verify token) en tiempo constante.
    // FixedTimeEquals devuelve false de inmediato si las longitudes difieren,
    // lo que filtraría la longitud del secreto: comparando los SHA-256
    // (siempre 32 bytes) la comparación no depende del contenido ni del largo.
    // Un secreto configurado vacío nunca coincide (nunca "vacío = abierto").
    public static bool SecretosIguales(string? recibido, string? configurado)
    {
        if (string.IsNullOrWhiteSpace(configurado) || string.IsNullOrEmpty(recibido))
        {
            return false;
        }

        var hashRecibido = SHA256.HashData(Encoding.UTF8.GetBytes(recibido));
        var hashConfigurado = SHA256.HashData(Encoding.UTF8.GetBytes(configurado));

        return CryptographicOperations.FixedTimeEquals(hashRecibido, hashConfigurado);
    }
}
