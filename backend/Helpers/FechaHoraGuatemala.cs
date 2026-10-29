namespace Peredent.Api.Helpers;

public static class FechaHoraGuatemala
{
    // Guatemala es UTC-6 todo el año (sin horario de verano).
    private static readonly TimeSpan DiferenciaConUtc = TimeSpan.FromHours(-6);

    // Hora actual en Guatemala. Autoridad para "fecha pasada", "todavía no
    // llega la hora" y "citas de mañana": el navegador o el servidor pueden
    // estar en otra zona horaria, pero el backend siempre decide con esta
    // referencia. Las citas se guardan en esta misma hora local (no en UTC).
    public static DateTime Ahora() => DesdeUtc(DateTimeOffset.UtcNow);

    // Un instante (p. ej. el timestamp Unix de un mensaje de WhatsApp) en hora
    // local de Guatemala, con el mismo criterio que Ahora().
    public static DateTime DesdeUtc(DateTimeOffset instante) =>
        DateTime.SpecifyKind(instante.UtcDateTime + DiferenciaConUtc, DateTimeKind.Unspecified);
}
