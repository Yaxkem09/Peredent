using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Services;

// SCRUM-235 / SCRUM-239: política de contraseñas compartida por restablecer y
// cambiar contraseña.
public class PoliticaContrasenaTests
{
    [Theory]
    [InlineData("Clave123")]        // justo los 8 mínimos
    [InlineData("ClaveSegura123")]
    [InlineData("Aa1bbbbb")]
    public void Validar_ClavesQueCumplen_DevuelveNull(string clave)
    {
        Assert.Null(PoliticaContrasena.Validar(clave));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Clave1")]              // muy corta
    [InlineData("clavesegura123")]      // sin mayúscula
    [InlineData("CLAVESEGURA123")]      // sin minúscula
    [InlineData("ClaveSegura")]         // sin número
    public void Validar_ClavesQueNoCumplen_DevuelveMensaje(string? clave)
    {
        Assert.False(string.IsNullOrWhiteSpace(PoliticaContrasena.Validar(clave)));
    }

    [Fact]
    public void Validar_ClaveCorta_MencionaElMinimoDeCaracteres()
    {
        Assert.Contains("8", PoliticaContrasena.Validar("Ab1"));
    }

    [Fact]
    public void Validar_ClaveDe128Caracteres_EsValida()
    {
        var clave = new string('a', 126) + "A1";

        Assert.Null(PoliticaContrasena.Validar(clave));
    }

    [Fact]
    public void Validar_ClaveDe129Caracteres_DevuelveMensaje()
    {
        var clave = new string('a', 127) + "A1";

        Assert.Contains("128", PoliticaContrasena.Validar(clave));
    }
}
