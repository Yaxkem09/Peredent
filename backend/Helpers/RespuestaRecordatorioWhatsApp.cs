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

    // Mensajes de vuelta ({telefono} y {horario} vienen de ClinicaOptions).
    public const string MensajeConfirmado = "¡Gracias por confirmar! Le esperamos en su cita.";
    public const string MensajeModificar = "Para modificar su cita, llámenos al {telefono}.\n\n*Horario de atención:*\n{horario}";
    public const string MensajeCitaPasada = "Esta cita ya pasó. Si necesita una nueva cita, llámenos al {telefono}.";
    public const string MensajeCitaCancelada = "Esta cita fue cancelada. Si desea reagendar, llámenos al {telefono}.";

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
