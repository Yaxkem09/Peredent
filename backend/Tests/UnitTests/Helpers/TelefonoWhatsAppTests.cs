using Peredent.Api.Helpers;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Helpers;

public class TelefonoWhatsAppTests
{
    [Theory]
    [InlineData("51234567", "50251234567")]
    [InlineData("22334455", "50222334455")]
    public void Normalizar_OchoDigitos_AgregaCodigoGuatemala(string telefono, string esperado)
    {
        Assert.Equal(esperado, TelefonoWhatsApp.Normalizar(telefono));
    }

    [Theory]
    [InlineData("+50251234567")]
    [InlineData("+502 5123 4567")]
    [InlineData("+502-5123-4567")]
    public void Normalizar_ConMas502_QuitaElMas(string telefono)
    {
        Assert.Equal("50251234567", TelefonoWhatsApp.Normalizar(telefono));
    }

    [Theory]
    [InlineData("5123-4567")]
    [InlineData("5123 4567")]
    [InlineData(" 5123 - 4567 ")]
    [InlineData("(502) 5123-4567")]
    public void Normalizar_ConEspaciosYGuiones_DejaSoloDigitos(string telefono)
    {
        Assert.Equal("50251234567", TelefonoWhatsApp.Normalizar(telefono));
    }

    [Fact]
    public void Normalizar_YaNormalizadoCon502_LoDejaIgual()
    {
        Assert.Equal("50251234567", TelefonoWhatsApp.Normalizar("50251234567"));
    }

    [Theory]
    [InlineData("5123456")]        // 7 dígitos
    [InlineData("512345671")]      // 9 dígitos
    [InlineData("50351234567")]    // 11 dígitos con otro código de país
    [InlineData("0050251234567")]  // prefijo internacional 00
    [InlineData("5025123456")]     // 502 + 7 dígitos
    [InlineData("sin telefono")]
    [InlineData("---")]
    public void Normalizar_Invalido_DevuelveNull(string telefono)
    {
        Assert.Null(TelefonoWhatsApp.Normalizar(telefono));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Normalizar_Vacio_DevuelveNull(string? telefono)
    {
        Assert.Null(TelefonoWhatsApp.Normalizar(telefono));
    }

    [Theory]
    [InlineData("50251234567", "*******4567")]
    [InlineData("5123-4567", "****4567")]
    [InlineData("+502 5123 4567", "*******4567")]
    public void Enmascarar_DejaSoloLosUltimos4Digitos(string telefono, string esperado)
    {
        Assert.Equal(esperado, TelefonoWhatsApp.Enmascarar(telefono));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("4567")]
    public void Enmascarar_CuatroDigitosOMenos_NoMuestraNinguno(string? telefono)
    {
        Assert.Equal("****", TelefonoWhatsApp.Enmascarar(telefono));
    }
}
