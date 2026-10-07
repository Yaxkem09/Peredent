using System.Security.Cryptography;
using System.Text;
using BCrypt.Net;

namespace Peredent.Api.Services;

// SCRUM-230: contraseñas con bcrypt (BCrypt.Net-Next). Se usa la variante
// "enhanced" (SHA-384 antes de bcrypt) para no quedar limitados a los 72 bytes
// que acepta bcrypt a pelo, y work factor 12 (SCRUM-235).
// El salt va dentro del propio hash, así que la columna Salt se conserva (es NOT
// NULL) pero queda en cadena vacía para los hashes nuevos.
public class PasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 12;
    private const HashType Variante = HashType.SHA384;

    public string Hashear(string clave)
    {
        return BCrypt.Net.BCrypt.EnhancedHashPassword(clave, Variante, WorkFactor);
    }

    public bool Verificar(string clave, string hashGuardado, string? salt)
    {
        if (string.IsNullOrEmpty(hashGuardado))
        {
            return false;
        }

        if (EsBcrypt(hashGuardado))
        {
            try
            {
                return BCrypt.Net.BCrypt.EnhancedVerify(clave, hashGuardado, Variante);
            }
            catch (SaltParseException)
            {
                // Hash con pinta de bcrypt pero corrupto: se trata como no verificado.
                return false;
            }
        }

        // Formato legado: SHA2_256(clave + salt) en hexadecimal, igual que
        // HASHBYTES('SHA2_256', ...) del script de creación de la base. La
        // comparación es en tiempo constante y case-insensitive porque SQL Server
        // devuelve el hexadecimal en mayúsculas.
        var calculado = HashLegado(clave, salt ?? string.Empty);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(calculado.ToUpperInvariant()),
            Encoding.UTF8.GetBytes(hashGuardado.ToUpperInvariant()));
    }

    public bool NecesitaMigracion(string hashGuardado) => !EsBcrypt(hashGuardado);

    // Los hashes bcrypt empiezan con "$2" ($2a$, $2b$, $2y$).
    private static bool EsBcrypt(string hashGuardado) => hashGuardado.StartsWith("$2", StringComparison.Ordinal);

    // Solo se usa para VERIFICAR el formato viejo: ya no se generan hashes nuevos
    // con este algoritmo (todo alta y cambio de contraseña guarda bcrypt).
    private static string HashLegado(string clave, string salt)
    {
        var bytes = Encoding.UTF8.GetBytes(clave + salt);
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }
}
