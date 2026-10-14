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
}
