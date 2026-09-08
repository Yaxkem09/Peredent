using System.Security.Cryptography;
using System.Text;

namespace Peredent.Api.Services;

public class PasswordHasher : IPasswordHasher
{
    public string GenerarSalt() => Guid.NewGuid().ToString();

    // Debe producir el mismo hash que HASHBYTES('SHA2_256', clave + salt) del script de
    // creación de la base. La comparación con el valor guardado es case-insensitive porque
    // SQL Server convierte ese binario a hexadecimal en mayúsculas.
    public string HashClave(string clave, string salt)
    {
        var bytes = Encoding.UTF8.GetBytes(clave + salt);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
