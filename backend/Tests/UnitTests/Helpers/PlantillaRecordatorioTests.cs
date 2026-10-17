using Peredent.Api.Helpers;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Helpers;

public class PlantillaRecordatorioTests
{
    [Theory]
    [InlineData("Juan", "Pérez", "Juan Pérez")]
    [InlineData("María José", "González López", "María González")]
    [InlineData("  Ana   Lucía ", "  de León  ", "Ana de")]
    [InlineData("Carlos", "", "Carlos")]
    public void Nombre_PrimerNombreYPrimerApellido(string nombres, string apellidos, string esperado)
    {
        Assert.Equal(esperado, PlantillaRecordatorio.Nombre(nombres, apellidos));
    }

    [Theory]
    [InlineData(2026, 9, 28, "lunes 28 de septiembre")]
    [InlineData(2026, 10, 3, "sábado 3 de octubre")]
    [InlineData(2027, 1, 1, "viernes 1 de enero")]
    public void Fecha_DiaSemanaDiaYMesEnMinusculas(int anio, int mes, int dia, string esperado)
    {
        Assert.Equal(esperado, PlantillaRecordatorio.Fecha(new DateTime(anio, mes, dia, 10, 0, 0)));
    }

    [Theory]
    [InlineData(9, 0, "9:00 AM")]
    [InlineData(15, 30, "3:30 PM")]
    [InlineData(12, 0, "12:00 PM")]
    [InlineData(0, 0, "12:00 AM")]
    [InlineData(18, 45, "6:45 PM")]
    public void Hora_SinCeroInicialConAmPm(int hora, int minuto, string esperado)
    {
        Assert.Equal(esperado, PlantillaRecordatorio.Hora(new DateTime(2026, 9, 28, hora, minuto, 0)));
    }
}
