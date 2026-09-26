namespace Peredent.Api.Services;

public interface IWhatsAppService
{
    // Envía la plantilla de recordatorio de cita. Nunca lanza por errores de
    // Meta, de red o timeouts (vienen en el resultado); solo propaga la
    // cancelación cuando la pide el ct.
    // telefono: ya normalizado (ver TelefonoWhatsApp.Normalizar).
    Task<WhatsAppEnvioResultado> EnviarRecordatorioCitaAsync(
        string telefono, string nombrePaciente, string fecha, string hora, CancellationToken ct);
}

// MessageId es el "wamid" que devuelve Meta al aceptar el mensaje; Error trae
// el motivo del fallo (incluido el código de error de Meta cuando lo hay).
public record WhatsAppEnvioResultado(bool Exitoso, string? MessageId, string? Error)
{
    public static WhatsAppEnvioResultado Ok(string? messageId) => new(true, messageId, null);

    public static WhatsAppEnvioResultado Fallo(string error) => new(false, null, error);
}
