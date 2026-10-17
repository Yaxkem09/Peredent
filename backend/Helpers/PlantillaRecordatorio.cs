using System.Globalization;

namespace Peredent.Api.Helpers;

// Variables de la plantilla "recordatorio_cita" de WhatsApp:
// {{1}} nombre, {{2}} fecha, {{3}} hora.
public static class PlantillaRecordatorio
{
    private static readonly CultureInfo CulturaGuatemala = CultureInfo.GetCultureInfo("es-GT");

    // Primer nombre + primer apellido ("María José" "González López" => "María González").
    public static string Nombre(string nombres, string apellidos) =>
        string.Join(' ', new[] { PrimeraPalabra(nombres), PrimeraPalabra(apellidos) }.Where(p => p.Length > 0));

    // "lunes 28 de septiembre": cultura explícita, no la del servidor.
    public static string Fecha(DateTime fecha) =>
        fecha.ToString("dddd d 'de' MMMM", CulturaGuatemala).ToLower(CulturaGuatemala);

    // "9:00 AM" / "3:30 PM": InvariantCulture porque es-GT daría "a. m.".
    public static string Hora(DateTime fecha) =>
        fecha.ToString("h:mm tt", CultureInfo.InvariantCulture);

    private static string PrimeraPalabra(string? texto) =>
        (texto ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault() ?? string.Empty;
}
