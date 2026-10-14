namespace Peredent.Api.Options;

// Datos de contacto de la clínica que se usan en los mensajes de WhatsApp de
// vuelta al paciente. Opcionales: CLINICA_TELEFONO y CLINICA_HORARIO.
public class ClinicaOptions
{
    public string Telefono { get; set; } = "7755-1080";

    public string Horario { get; set; } =
        "Lunes a viernes: 8:00 AM a 1:00 PM y 2:00 PM a 6:00 PM\nSábados: 8:00 AM a 1:00 PM";
}
