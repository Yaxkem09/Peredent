using Peredent.Api.DTOs.Response;

namespace Peredent.Api.Services;

public interface IRecordatorioService
{
    // Envía el recordatorio por WhatsApp de las citas de mañana (hora de
    // Guatemala) que todavía no lo tienen. dryRun = solo reporta lo que se
    // enviaría, sin llamar a WhatsApp ni tocar la base. Si ya hay otra
    // ejecución real en curso devuelve EjecucionEnCurso = true sin enviar nada.
    Task<RecordatorioResumenDto> EnviarRecordatoriosDeMananaAsync(bool dryRun, CancellationToken ct);
}
