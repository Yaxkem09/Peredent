using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Services;

public class PasswordHasherTests
{
    [Fact]
    public void HashClave_MismaClaveYMismoSalt_ProduceElMismoHash()
    {
        var hasher = new PasswordHasher();

        var hash1 = hasher.HashClave("miClave123", "salt-fijo");
        var hash2 = hasher.HashClave("miClave123", "salt-fijo");

        Assert.Equal(hash1, hash2);
    }

    [Fact]
    public void HashClave_MismaClaveConDistintoSalt_ProduceDistintoHash()
    {
        var hasher = new PasswordHasher();

        var hash1 = hasher.HashClave("miClave123", "salt-uno");
        var hash2 = hasher.HashClave("miClave123", "salt-dos");

        Assert.NotEqual(hash1, hash2);
    }

    [Fact]
    public void HashClave_ClaveIncorrecta_NoCoincideConElHashGuardado()
    {
        var hasher = new PasswordHasher();
        var salt = hasher.GenerarSalt();
        var hashGuardado = hasher.HashClave("claveCorrecta", salt);

        var hashIntento = hasher.HashClave("claveIncorrecta", salt);

        Assert.NotEqual(hashGuardado, hashIntento);
    }
}
