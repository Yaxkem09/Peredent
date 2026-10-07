using System.Security.Cryptography;
using System.Text;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Services;

// SCRUM-230: contraseñas con bcrypt y verificación del formato legado.
public class PasswordHasherTests
{
    private const string ClaveValida = "ClaveSegura123";

    private readonly PasswordHasher _hasher = new();

    // El hash bcrypt mide 60 caracteres: entra en Contrasena_Hash VARCHAR(64).
    [Fact]
    public void Hashear_ProduceUnHashBcryptQueCabeEnLaColumna()
    {
        var hash = _hasher.Hashear(ClaveValida);

        Assert.StartsWith("$2", hash);
        Assert.Equal(60, hash.Length);
        Assert.True(hash.Length <= 64);
    }

    // bcrypt lleva su propio salt dentro del hash: la misma clave da hashes distintos.
    [Fact]
    public void Hashear_LaMismaClaveDosVeces_ProduceHashesDistintos()
    {
        var hash1 = _hasher.Hashear(ClaveValida);
        var hash2 = _hasher.Hashear(ClaveValida);

        Assert.NotEqual(hash1, hash2);
    }

    [Fact]
    public void Verificar_HashBcryptCorrecto_DevuelveTrue()
    {
        var hash = _hasher.Hashear(ClaveValida);

        // Los hashes nuevos se guardan con Salt vacío.
        Assert.True(_hasher.Verificar(ClaveValida, hash, string.Empty));
    }

    [Fact]
    public void Verificar_HashBcryptConClaveIncorrecta_DevuelveFalse()
    {
        var hash = _hasher.Hashear(ClaveValida);

        Assert.False(_hasher.Verificar("OtraClave123", hash, string.Empty));
    }

    // Los usuarios viejos (y el admin sembrado por SQL) siguen entrando: su hash es
    // SHA2_256(clave + salt) en hexadecimal.
    [Fact]
    public void Verificar_HashLegadoSha256ConSalt_DevuelveTrue()
    {
        var hashLegado = HashLegadoComoLaBase(ClaveValida, "salt-viejo");

        Assert.True(_hasher.Verificar(ClaveValida, hashLegado, "salt-viejo"));
        // SQL Server devuelve ese hexadecimal en mayúsculas: la comparación lo tolera.
        Assert.True(_hasher.Verificar(ClaveValida, hashLegado.ToUpperInvariant(), "salt-viejo"));
    }

    [Fact]
    public void Verificar_HashLegadoConClaveIncorrecta_DevuelveFalse()
    {
        var hashLegado = HashLegadoComoLaBase(ClaveValida, "salt-viejo");

        Assert.False(_hasher.Verificar("OtraClave123", hashLegado, "salt-viejo"));
    }

    [Fact]
    public void Verificar_HashVacio_DevuelveFalse()
    {
        Assert.False(_hasher.Verificar(ClaveValida, string.Empty, string.Empty));
    }

    [Fact]
    public void NecesitaMigracion_SoloParaElFormatoLegado()
    {
        Assert.True(_hasher.NecesitaMigracion(HashLegadoComoLaBase(ClaveValida, "salt-viejo")));
        Assert.False(_hasher.NecesitaMigracion(_hasher.Hashear(ClaveValida)));
    }

    // La variante "enhanced" (SHA-384 antes de bcrypt) evita el límite de 72 bytes:
    // dos claves que solo difieren después del byte 72 no verifican entre sí.
    [Fact]
    public void Hashear_ClaveDe130Caracteres_VerificaBien()
    {
        var larga = new string('a', 70) + "B1" + new string('c', 58);
        var distinta = new string('a', 70) + "B2" + new string('c', 58);

        var hash = _hasher.Hashear(larga);

        Assert.True(_hasher.Verificar(larga, hash, string.Empty));
        Assert.False(_hasher.Verificar(distinta, hash, string.Empty));
    }

    // Igual que HASHBYTES('SHA2_256', clave + salt) del script de la base: es el
    // contrato del formato viejo, no una copia del código de producción.
    private static string HashLegadoComoLaBase(string clave, string salt)
    {
        var bytes = Encoding.UTF8.GetBytes(clave + salt);
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }
}
