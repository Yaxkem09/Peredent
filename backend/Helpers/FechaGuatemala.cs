namespace Peredent.Api.Helpers;

// Fechas del sistema en hora de Guatemala. Guatemala es UTC-6 todo el año (no
// observa horario de verano), así que un offset fijo evita depender de que el
// servidor tenga cargada la zona horaria.
// Se marcan como Unspecified (no Utc): son fechas/horas de calendario local, no
// un instante. Si conservaran Kind=Utc, al serializarse a JSON saldrían con
// sufijo "Z" y el frontend las mostraría corridas al convertir a hora local.
public static class FechaGuatemala
{
    // Día de calendario, sin hora: fechas de plan, de cierre, etc.
    public static DateTime Hoy()
    {
        return DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-6).Date, DateTimeKind.Unspecified);
    }

    // SCRUM-64: momento exacto (con hora) en que se registra un abono.
    public static DateTime Ahora()
    {
        return DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-6), DateTimeKind.Unspecified);
    }
}
