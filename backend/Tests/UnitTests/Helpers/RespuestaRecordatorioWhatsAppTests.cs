using Peredent.Api.Helpers;
using Peredent.Api.Options;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Helpers;

public class RespuestaRecordatorioWhatsAppTests
{
    [Theory]
    [InlineData("Sí asistiré", null)]
    [InlineData(null, "Sí asistiré")]
    [InlineData("  sí ASISTIRÉ ", null)]
    [InlineData("Sí asistiré", null)] // tildes como caracteres combinados (otra forma Unicode)
    public void IdentificarOpcion_Confirmar(string? payload, string? texto)
    {
        Assert.Equal(OpcionRespuestaRecordatorio.Confirmar, RespuestaRecordatorioWhatsApp.IdentificarOpcion(payload, texto));
    }

    [Theory]
    [InlineData("Modificar mi cita", "Modificar mi cita")]
    [InlineData("otro-payload", "Modificar mi cita")] // payload personalizado: decide el texto
    public void IdentificarOpcion_Modificar(string? payload, string? texto)
    {
        Assert.Equal(OpcionRespuestaRecordatorio.Modificar, RespuestaRecordatorioWhatsApp.IdentificarOpcion(payload, texto));
    }

    [Theory]
    [InlineData("Cancelar", "Cancelar")]
    [InlineData("Si asistire", null)] // sin tildes no es el texto del botón
    [InlineData("", "")]
    [InlineData(null, null)]
    public void IdentificarOpcion_Desconocida_DevuelveNull(string? payload, string? texto)
    {
        Assert.Null(RespuestaRecordatorioWhatsApp.IdentificarOpcion(payload, texto));
    }

    [Fact]
    public void Formatear_ReemplazaTelefonoYHorario()
    {
        var clinica = new ClinicaOptions { Telefono = "5555-0000", Horario = "Lunes: 8 a 5\nSábados: 8 a 12" };

        var mensaje = RespuestaRecordatorioWhatsApp.Formatear(RespuestaRecordatorioWhatsApp.MensajeModificar, clinica);

        Assert.Equal("Para modificar su cita, llámenos al 5555-0000.\n\n*Horario de atención:*\nLunes: 8 a 5\nSábados: 8 a 12", mensaje);
    }

    [Fact]
    public void ValoresGuardados_CabenEnLaColumna()
    {
        // Citas.RespuestaPaciente es VARCHAR(20).
        Assert.True(RespuestaRecordatorioWhatsApp.RespuestaConfirmo.Length <= 20);
        Assert.True(RespuestaRecordatorioWhatsApp.RespuestaModificar.Length <= 20);
    }

    // ---------- Antigüedad de la respuesta ----------

    private static readonly DateTimeOffset Ahora = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);

    private static string Unix(DateTimeOffset momento) =>
        momento.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);

    [Fact]
    public void Antiguedad_CalculaDesdeElTimestampUnix()
    {
        Assert.Equal(TimeSpan.FromMinutes(90), RespuestaRecordatorioWhatsApp.Antiguedad(Unix(Ahora.AddMinutes(-90)), Ahora));
    }

    [Fact]
    public void Antiguedad_TimestampEnElFuturo_CuentaComoCero()
    {
        Assert.Equal(TimeSpan.Zero, RespuestaRecordatorioWhatsApp.Antiguedad(Unix(Ahora.AddMinutes(3)), Ahora));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" 1760290000")]
    [InlineData("abc")]
    [InlineData("-60")]
    [InlineData("1760290000.5")]
    [InlineData("99999999999999999999")]
    public void Antiguedad_TimestampAusenteOIlegible_DevuelveNull(string? timestamp)
    {
        Assert.Null(RespuestaRecordatorioWhatsApp.Antiguedad(timestamp, Ahora));
    }

    [Fact]
    public void EsRespuestaTardia_SoloSiSuperaElLimite()
    {
        var limite = RespuestaRecordatorioWhatsApp.AntiguedadMaximaParaResponder;

        Assert.False(RespuestaRecordatorioWhatsApp.EsRespuestaTardia(null));
        Assert.False(RespuestaRecordatorioWhatsApp.EsRespuestaTardia(limite));
        Assert.True(RespuestaRecordatorioWhatsApp.EsRespuestaTardia(limite + TimeSpan.FromSeconds(1)));
        Assert.Equal(TimeSpan.FromMinutes(60), limite);
    }

    [Fact]
    public void HoraDelToque_ConvierteElTimestampAHoraDeGuatemala()
    {
        // 2026-10-28 12:00 UTC = 06:00 en Guatemala (UTC-6).
        Assert.Equal(new DateTime(2026, 10, 28, 6, 0, 0), RespuestaRecordatorioWhatsApp.HoraDelToque(Unix(Ahora)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("abc")]
    public void HoraDelToque_TimestampInvalido_DevuelveNull(string? timestamp)
    {
        Assert.Null(RespuestaRecordatorioWhatsApp.HoraDelToque(timestamp));
    }
}
