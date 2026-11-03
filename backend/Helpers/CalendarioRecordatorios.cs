namespace Peredent.Api.Helpers;

// Único lugar con la regla de QUÉ citas se recuerdan cada día (decisión de la
// clínica): cada cita recibe su recordatorio el día anterior, salvo las del
// lunes, que lo reciben el viernes (un solo recordatorio). El domingo no se
// envía nada para el lunes: una cita del lunes agendada después de las
// corridas del viernes no recibe recordatorio.
public static class CalendarioRecordatorios
{
    // Fechas de las citas que se recuerdan hoy (hoy en hora de Guatemala).
    public static IReadOnlyList<DateOnly> FechasObjetivo(DateOnly hoy) => hoy.DayOfWeek switch
    {
        DayOfWeek.Friday => new[] { hoy.AddDays(1), hoy.AddDays(3) },  // sábado y lunes
        DayOfWeek.Saturday => new[] { hoy.AddDays(1) },                 // domingo
        DayOfWeek.Sunday => Array.Empty<DateOnly>(),                    // el lunes ya se recordó el viernes
        _ => new[] { hoy.AddDays(1) },                                  // lunes a jueves: el día siguiente
    };

    // Regla inversa: el día en que se envía el recordatorio de una cita. Las del
    // lunes, el viernes anterior; las demás, el día anterior. Debe ser
    // consistente con FechasObjetivo (lo verifican las pruebas). Si hoy ya es
    // posterior a este día y la cita no tiene recordatorio, ya no lo recibirá.
    public static DateOnly DiaDeEnvio(DateOnly fechaCita) =>
        fechaCita.DayOfWeek == DayOfWeek.Monday ? fechaCita.AddDays(-3) : fechaCita.AddDays(-1);
}
