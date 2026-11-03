using Peredent.Api.Helpers;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Helpers;

public class CalendarioRecordatoriosTests
{
    // Semana del lunes 2 al domingo 8 de noviembre de 2026.
    [Theory]
    [InlineData("2026-11-02", new[] { "2026-11-03" })]               // lunes -> martes
    [InlineData("2026-11-03", new[] { "2026-11-04" })]               // martes -> miércoles
    [InlineData("2026-11-04", new[] { "2026-11-05" })]               // miércoles -> jueves
    [InlineData("2026-11-05", new[] { "2026-11-06" })]               // jueves -> viernes
    [InlineData("2026-11-06", new[] { "2026-11-07", "2026-11-09" })] // viernes -> sábado y lunes
    [InlineData("2026-11-07", new[] { "2026-11-08" })]               // sábado -> domingo
    [InlineData("2026-11-08", new string[0])]                        // domingo -> ninguna (el lunes se recordó el viernes)
    public void FechasObjetivo_SegunElDiaDeLaSemana(string hoy, string[] esperadas)
    {
        var fechas = CalendarioRecordatorios.FechasObjetivo(DateOnly.Parse(hoy));

        Assert.Equal(esperadas.Select(DateOnly.Parse), fechas);
    }

    [Fact]
    public void FechasObjetivo_ElLunesSoloSeRecuerdaElViernes()
    {
        var lunes = new DateOnly(2026, 11, 9);
        var semanaAnterior = Enumerable.Range(0, 7).Select(i => lunes.AddDays(-7 + i)); // lunes 2 .. domingo 8

        var diasQueLoRecuerdan = semanaAnterior.Where(d => CalendarioRecordatorios.FechasObjetivo(d).Contains(lunes)).ToList();

        Assert.Equal(new[] { new DateOnly(2026, 11, 6) }, diasQueLoRecuerdan); // solo el viernes 6
    }

    // ---------- Regla inversa: día de envío de una cita ----------

    [Theory]
    [InlineData("2026-11-09", "2026-11-06")] // lunes -> viernes anterior
    [InlineData("2026-11-10", "2026-11-09")] // martes -> lunes
    [InlineData("2026-11-11", "2026-11-10")] // miércoles -> martes
    [InlineData("2026-11-12", "2026-11-11")] // jueves -> miércoles
    [InlineData("2026-11-13", "2026-11-12")] // viernes -> jueves
    [InlineData("2026-11-14", "2026-11-13")] // sábado -> viernes
    [InlineData("2026-11-15", "2026-11-14")] // domingo -> sábado
    [InlineData("2027-01-04", "2027-01-01")] // lunes 4 de enero -> viernes 1 de enero
    [InlineData("2027-01-01", "2026-12-31")] // viernes 1 de enero -> jueves del año anterior
    public void DiaDeEnvio_LunesElViernesAnteriorYElRestoElDiaAnterior(string fechaCita, string esperado)
    {
        Assert.Equal(DateOnly.Parse(esperado), CalendarioRecordatorios.DiaDeEnvio(DateOnly.Parse(fechaCita)));
    }

    [Fact]
    public void DiaDeEnvio_EsConsistenteConFechasObjetivo()
    {
        // Para cada fecha de cita en 8 semanas: exactamente un día de la semana
        // previa la incluye en sus fechas objetivo, y es su DiaDeEnvio.
        var inicio = new DateOnly(2026, 11, 2);
        foreach (var fechaCita in Enumerable.Range(0, 56).Select(i => inicio.AddDays(i)))
        {
            var diasQueLaRecuerdan = Enumerable.Range(1, 7)
                .Select(i => fechaCita.AddDays(-i))
                .Where(dia => CalendarioRecordatorios.FechasObjetivo(dia).Contains(fechaCita))
                .ToList();

            Assert.Equal(new[] { CalendarioRecordatorios.DiaDeEnvio(fechaCita) }, diasQueLaRecuerdan);
        }
    }
}
