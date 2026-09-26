using Peredent.Api.Helpers;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Helpers;

public class TelefonoWhatsAppTests
{
    [Theory]
    [InlineData("45278707", "50245278707")]
    [InlineData("22334455", "50222334455")]
    public void Normalizar_OchoDigitos_AgregaCodigoGuatemala(string telefono, string esperado)
    {
        Assert.Equal(esperado, TelefonoWhatsApp.Normalizar(telefono));
    }

    [Theory]
    [InlineData("+50245278707")]
    [InlineData("+502 4527 8707")]
    [InlineData("+502-4527-8707")]
    public void Normalizar_ConMas502_QuitaElMas(string telefono)
    {
        Assert.Equal("50245278707", TelefonoWhatsApp.Normalizar(telefono));
    }

    [Theory]
    [InlineData("4527-8707")]
    [InlineData("4527 8707")]
    [InlineData(" 4527 - 8707 ")]
    [InlineData("(502) 4527-8707")]
    public void Normalizar_ConEspaciosYGuiones_DejaSoloDigitos(string telefono)
    {
        Assert.Equal("50245278707", TelefonoWhatsApp.Normalizar(telefono));
    }

    [Fact]
    public void Normalizar_YaNormalizadoCon502_LoDejaIgual()
    {
        Assert.Equal("50245278707", TelefonoWhatsApp.Normalizar("50245278707"));
    }

    [Theory]
    [InlineData("4527870")]        // 7 dígitos
    [InlineData("452787071")]      // 9 dígitos
    [InlineData("50345278707")]    // 11 dígitos con otro código de país
    [InlineData("0050245278707")]  // prefijo internacional 00
    [InlineData("5024527870")]     // 502 + 7 dígitos
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
}
