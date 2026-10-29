using System.Text;
using Peredent.Api.Options;

namespace Peredent.Api.Helpers;

public enum OpcionRespuestaRecordatorio
{
    Confirmar,
    Modificar,
}

// Único lugar con los textos de la respuesta del paciente al recordatorio:
// los botones de la plantilla recordatorio_cita, lo que se guarda en
// Citas.RespuestaPaciente y los mensajes de vuelta. Si cambia la plantilla en
// Meta o la redacción, se cambia solo aquí.
public static class RespuestaRecordatorioWhatsApp
{
    // Texto de los botones de respuesta rápida, tal como están en la plantilla.
    public const string BotonConfirmar = "Sí asistiré";
    public const string BotonModificar = "Modificar mi cita";

    // Valores de Citas.RespuestaPaciente (VARCHAR(20)).
    public const string RespuestaConfirmo = "Confirmo";
    public const string RespuestaModificar = "Modificar";

    // Mensajes de vuelta ({telefono} y {horario} vienen de ClinicaOptions). A una
    // cita que ya empezó o pasó no se le contesta nada (ver WhatsAppWebhookService).
    public const string MensajeConfirmado = "¡Gracias por confirmar! Le esperamos en su cita.";
    public const string MensajeModificar = "Para modificar su cita, llámenos al {telefono}.\n\n*Horario de atención:*\n{horario}";
    public const string MensajeCitaCancelada = "Esta cita fue cancelada. Si desea reagendar, llámenos al {telefono}.";

    // Una respuesta más antigua que esto (p. ej. una que Meta reintenta horas o
    // días después porque el webhook estuvo caído) se sigue aplicando a la cita,
    // pero no se le contesta al paciente: un mensaje a las 6:00 a. m. por un
    // botón que tocó días antes confunde más de lo que ayuda.
    public static readonly TimeSpan AntiguedadMaximaParaResponder = TimeSpan.FromMinutes(60);

    // Antigüedad del mensaje a partir de su timestamp (segundos Unix, como texto,
    // tal como lo manda Meta: la hora en que el paciente tocó el botón). Devuelve
    // null si falta o no se puede leer. Un timestamp en el futuro (diferencia de
    // relojes) cuenta como antigüedad cero.
    public static TimeSpan? Antiguedad(string? timestampUnix, DateTimeOffset ahoraUtc)
    {
        var toque = LeerTimestamp(timestampUnix);
        if (toque is null)
        {
            return null;
        }

        var antiguedad = ahoraUtc - toque.Value;
        return antiguedad < TimeSpan.Zero ? TimeSpan.Zero : antiguedad;
    }

    // Hora en que el paciente tocó el botón, en hora de Guatemala (mismo
    // criterio que FechaHoraGuatemala). null si el timestamp falta o no se puede leer.
    public static DateTime? HoraDelToque(string? timestampUnix)
    {
        var toque = LeerTimestamp(timestampUnix);
        return toque is null ? null : FechaHoraGuatemala.DesdeUtc(toque.Value);
    }

    private static DateTimeOffset? LeerTimestamp(string? timestampUnix)
    {
        if (!long.TryParse(timestampUnix, System.Globalization.NumberStyles.None,
                System.Globalization.CultureInfo.InvariantCulture, out var segundos)
            || segundos > DateTimeOffset.MaxValue.ToUnixTimeSeconds())
        {
            return null;
        }

        return DateTimeOffset.FromUnixTimeSeconds(segundos);
    }

    public static bool EsRespuestaTardia(TimeSpan? antiguedad) =>
        antiguedad is not null && antiguedad.Value > AntiguedadMaximaParaResponder;

    // Meta manda el texto del botón en button.payload y button.text (para los
    // botones de una plantilla suelen ser iguales). Se acepta cualquiera de los
    // dos, sin distinguir mayúsculas, espacios extra ni la forma Unicode de la tilde.
    public static OpcionRespuestaRecordatorio? IdentificarOpcion(string? payload, string? texto)
    {
        foreach (var valor in new[] { payload, texto })
        {
            if (Coincide(valor, BotonConfirmar))
            {
                return OpcionRespuestaRecordatorio.Confirmar;
            }

            if (Coincide(valor, BotonModificar))
            {
                return OpcionRespuestaRecordatorio.Modificar;
            }
        }

        return null;
    }

    public static string ValorGuardado(OpcionRespuestaRecordatorio opcion) => opcion switch
    {
        OpcionRespuestaRecordatorio.Confirmar => RespuestaConfirmo,
        _ => RespuestaModificar,
    };

    public static string Formatear(string plantilla, ClinicaOptions clinica) =>
        plantilla.Replace("{telefono}", clinica.Telefono).Replace("{horario}", clinica.Horario);

    private static bool Coincide(string? valor, string boton) =>
        valor is not null
        && string.Equals(
            valor.Trim().Normalize(NormalizationForm.FormC),
            boton.Normalize(NormalizationForm.FormC),
            StringComparison.OrdinalIgnoreCase);
}
