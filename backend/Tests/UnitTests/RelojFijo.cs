using Peredent.Api.Helpers;

namespace Peredent.Api.Tests.UnitTests;

// TimeProvider de prueba: "ahora" es la hora de Guatemala que se le indique
// (se convierte a UTC sumando las 6 h de diferencia) y se puede mover entre
// corridas, p. ej. del viernes 9:07 al viernes 17:07.
internal sealed class RelojFijo : TimeProvider
{
    private DateTimeOffset _utc;

    public RelojFijo(DateTime horaGuatemala) => Fijar(horaGuatemala);

    public void Fijar(DateTime horaGuatemala) =>
        _utc = new DateTimeOffset(DateTime.SpecifyKind(horaGuatemala, DateTimeKind.Unspecified).AddHours(6), TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => _utc;

    // Próxima fecha (hoy incluido, hora de Guatemala) que cae en `dia`: siempre
    // hoy o en el futuro, para que CitaService no la rechace como fecha pasada.
    public static DateTime Proximo(DayOfWeek dia)
    {
        var hoy = FechaHoraGuatemala.Ahora().Date;
        return hoy.AddDays(((int)dia - (int)hoy.DayOfWeek + 7) % 7);
    }
}
