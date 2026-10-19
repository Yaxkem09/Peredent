using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.Helpers;
using Peredent.Api.Models;
using Peredent.Api.Options;

namespace Peredent.Api.Services;

// Procesa las respuestas de los pacientes a los botones del recordatorio
// ("Sí asistiré" / "Modificar mi cita"). Los textos están en RespuestaRecordatorioWhatsApp.
public class WhatsAppWebhookService : IWhatsAppWebhookService
{
    private const string TipoBoton = "button";
    private const string EstadoPendiente = "Pendiente";
    private const string EstadoConfirmada = "Confirmada";
    private const string EstadoCancelada = "Cancelada";

    private readonly ApplicationDbContext _db;
    private readonly IWhatsAppService _whatsApp;
    private readonly ClinicaOptions _clinica;
    private readonly ILogger<WhatsAppWebhookService> _logger;

    public WhatsAppWebhookService(
        ApplicationDbContext db,
        IWhatsAppService whatsApp,
        IOptions<ClinicaOptions> clinica,
        ILogger<WhatsAppWebhookService> logger)
    {
        _db = db;
        _whatsApp = whatsApp;
        _clinica = clinica.Value;
        _logger = logger;
    }

    public async Task ProcesarAsync(WhatsAppWebhookPayload payload, CancellationToken ct)
    {
        var values = payload.Entry
            .SelectMany(e => e.Changes)
            .Select(c => c.Value)
            .OfType<WhatsAppWebhookValue>()
            .ToList();

        foreach (var estado in values.SelectMany(v => v.Statuses))
        {
            _logger.LogDebug("Webhook WhatsApp: estado {Estado} del mensaje {MessageId} ignorado", estado.Status, WamidWhatsApp.Enmascarar(estado.Id));
        }

        foreach (var mensaje in values.SelectMany(v => v.Messages))
        {
            if (mensaje.Type != TipoBoton)
            {
                // Texto escrito por el paciente, imágenes, etc.: no se procesan.
                _logger.LogDebug(
                    "Webhook WhatsApp: mensaje de tipo {Tipo} de {Telefono} ignorado",
                    mensaje.Type, TelefonoWhatsApp.Enmascarar(mensaje.From));
                continue;
            }

            // Un mensaje que falla no impide procesar los demás de la misma notificación.
            try
            {
                await ProcesarBotonAsync(mensaje, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al procesar la respuesta {MessageId} del webhook de WhatsApp", WamidWhatsApp.Enmascarar(mensaje.Id));
            }
        }
    }

    private async Task ProcesarBotonAsync(WhatsAppWebhookMessage mensaje, CancellationToken ct)
    {
        var telefonoEnmascarado = TelefonoWhatsApp.Enmascarar(mensaje.From);
        var idRecordatorio = mensaje.Context?.Id;

        var cita = string.IsNullOrEmpty(idRecordatorio)
            ? null
            : await _db.Citas
                .Include(c => c.EstadoCita)
                .FirstOrDefaultAsync(c => c.RecordatorioMessageId == idRecordatorio, ct);

        if (cita is null)
        {
            _logger.LogWarning(
                "Respuesta de {Telefono} ignorada: no hay cita con el recordatorio {RecordatorioId}",
                telefonoEnmascarado, WamidWhatsApp.Enmascarar(idRecordatorio));
            return;
        }

        if (!string.IsNullOrEmpty(mensaje.Id) && cita.RespuestaMessageId == mensaje.Id)
        {
            _logger.LogInformation("Respuesta {MessageId} de la cita {IdCita} ya procesada (webhook duplicado)", WamidWhatsApp.Enmascarar(mensaje.Id), cita.IdCita);
            return;
        }

        var opcion = RespuestaRecordatorioWhatsApp.IdentificarOpcion(mensaje.Button?.Payload, mensaje.Button?.Text);
        if (opcion is null)
        {
            _logger.LogWarning(
                "Respuesta de la cita {IdCita} ignorada: botón no reconocido ({Boton})",
                cita.IdCita, mensaje.Button?.Payload ?? mensaje.Button?.Text);
            return;
        }

        var respuesta = await AplicarReglasAsync(cita, opcion.Value, mensaje.Id, ct);
        await ResponderAsync(mensaje.From, cita.IdCita, respuesta, ct);
    }

    // Aplica las reglas y devuelve el mensaje de vuelta para el paciente.
    private async Task<string> AplicarReglasAsync(Cita cita, OpcionRespuestaRecordatorio opcion, string? idMensaje, CancellationToken ct)
    {
        var ahora = FechaHoraGuatemala.Ahora();
        var estado = cita.EstadoCita.TipoEstadoCita;

        // a. La cita ya empezó o pasó: no se cambia nada. Una cita Atendida o
        // No Asistió también se trata como pasada (ya no admite respuesta).
        var esCitaPasada = cita.FechaInicio <= ahora
            || (estado != EstadoPendiente && estado != EstadoConfirmada && estado != EstadoCancelada);
        if (esCitaPasada)
        {
            _logger.LogInformation("Respuesta {Opcion} a la cita {IdCita} sin cambios: la cita ya pasó", opcion, cita.IdCita);
            return RespuestaRecordatorioWhatsApp.MensajeCitaPasada;
        }

        if (opcion == OpcionRespuestaRecordatorio.Confirmar)
        {
            // b. Una cita cancelada no se reactiva con el botón; esta respuesta
            // no se registra (no es una confirmación válida).
            if (estado == EstadoCancelada)
            {
                _logger.LogInformation("Confirmación de la cita {IdCita} ignorada: la cita está cancelada", cita.IdCita);
                return RespuestaRecordatorioWhatsApp.MensajeCitaCancelada;
            }

            if (estado == EstadoPendiente)
            {
                var idConfirmada = await ObtenerIdEstadoAsync(EstadoConfirmada, ct)
                    ?? throw new InvalidOperationException("El catálogo de estados de cita no tiene el estado Confirmada.");
                cita.IdEstadoCita = idConfirmada;
            }
        }

        // c. Modificar no cambia el estado: solo se registra la solicitud.
        // En b y c la última respuesta válida reemplaza a la anterior.
        cita.RespuestaPaciente = RespuestaRecordatorioWhatsApp.ValorGuardado(opcion);
        cita.RespuestaPacienteEn = ahora;
        cita.RespuestaMessageId = idMensaje;

        // Se guarda antes de responder: si el envío falla, el cambio se conserva.
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Cita {IdCita}: respuesta del paciente {Respuesta} registrada", cita.IdCita, cita.RespuestaPaciente);

        return opcion == OpcionRespuestaRecordatorio.Confirmar
            ? RespuestaRecordatorioWhatsApp.MensajeConfirmado
            : RespuestaRecordatorioWhatsApp.MensajeModificar;
    }

    private async Task ResponderAsync(string? telefono, int idCita, string plantilla, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(telefono))
        {
            _logger.LogWarning("No se respondió al paciente de la cita {IdCita}: el mensaje no trae teléfono", idCita);
            return;
        }

        var resultado = await _whatsApp.EnviarTextoAsync(telefono, RespuestaRecordatorioWhatsApp.Formatear(plantilla, _clinica), ct);
        if (!resultado.Exitoso)
        {
            // El cambio de la cita ya se guardó y no se revierte.
            _logger.LogWarning("No se pudo responder al paciente de la cita {IdCita}: {Error}", idCita, resultado.Error);
        }
    }

    // Por nombre contra el catálogo (igual que CitaService), nunca por ID fijo.
    private Task<int?> ObtenerIdEstadoAsync(string nombre, CancellationToken ct) =>
        _db.EstadosCita
            .Where(e => e.TipoEstadoCita == nombre)
            .Select(e => (int?)e.IdEstadoCita)
            .FirstOrDefaultAsync(ct);
}
