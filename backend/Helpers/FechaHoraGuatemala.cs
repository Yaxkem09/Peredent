namespace Peredent.Api.Helpers;

public static class FechaHoraGuatemala
{
    // Hora actual en Guatemala (UTC-6, sin horario de verano). Autoridad para
    // "fecha pasada", "todavía no llega la hora" y "citas de mañana": el
    // navegador o el servidor pueden estar en otra zona horaria, pero el
    // backend siempre decide con esta referencia. Las citas se guardan en esta
    // misma hora local (no en UTC).
    public static DateTime Ahora() => DateTime.UtcNow.AddHours(-6);
}
