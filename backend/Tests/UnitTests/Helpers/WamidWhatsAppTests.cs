using Peredent.Api.Helpers;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Helpers;

public class WamidWhatsAppTests
{
    [Fact]
    public void Enmascarar_WamidReal_DejaSoloLosUltimos6CaracteresSinElTelefono()
    {
        var enmascarado = WamidWhatsApp.Enmascarar(WamidsDePrueba.Recordatorio);

        Assert.Equal("wamid.…" + WamidsDePrueba.Recordatorio[^6..], enmascarado);
        Assert.DoesNotContain(WamidsDePrueba.TelefonoBase64, enmascarado);
    }

    [Theory]
    [InlineData("ABCDEFGH123456", "wamid.…123456")] // sin prefijo
    [InlineData("wamid.123456", "wamid.…")]         // 6 o menos: no se muestra nada
    [InlineData("wamid.1", "wamid.…")]
    public void Enmascarar_CasosCortosOSinPrefijo(string wamid, string esperado)
    {
        Assert.Equal(esperado, WamidWhatsApp.Enmascarar(wamid));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Enmascarar_SinId(string? wamid)
    {
        Assert.Equal("(sin id)", WamidWhatsApp.Enmascarar(wamid));
    }
}
