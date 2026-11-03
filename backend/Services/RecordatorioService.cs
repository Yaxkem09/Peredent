using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Helpers;
using Peredent.Api.Models;

namespace Peredent.Api.Services;

public class RecordatorioService : IRecordatorioService
{
    private const string EstadoPendiente = "Pendiente";
    private const string EstadoConfirmada = "Confirmada";
    private const string MotivoSinConsentimiento = "sin consentimiento";
    private const string MotivoTelefonoInvalido = "teléfono inválido";

    // Igual que el varchar(500) de Citas.RecordatorioError.
    private const int LongitudMaximaError = 500;

    // Estático: la app corre en una sola instancia (Somee), así que basta un
    // candado en memoria para que dos llamadas al endpoint (p. ej. un reintento
    // de GitHub Actions) no envíen dos veces el mismo recordatorio.
    private static readonly SemaphoreSlim EjecucionEnCurso = new(1, 1);

    private readonly ApplicationDbContext _db;
    private readonly IWhatsAppService _whatsApp;
    private readonly ILogger<RecordatorioService> _logger;
    private readonly TimeProvider _reloj;

    // `reloj` permite fijar "hoy" en las pruebas (la regla depende del día de
    // la semana); en la app es TimeProvider.System.
    public RecordatorioService(
        ApplicationDbContext db, IWhatsAppService whatsApp, ILogger<RecordatorioService> logger, TimeProvider? reloj = null)
    {
        _db = db;
        _whatsApp = whatsApp;
        _logger = logger;
        _reloj = reloj ?? TimeProvider.System;
    }

    public async Task<RecordatorioResumenDto> EnviarRecordatoriosDeMananaAsync(bool dryRun, CancellationToken ct)
    {
        // Qué fechas se recuerdan hoy (viernes: sábado y lunes; domingo: ninguna
        // para el lunes...). Ver CalendarioRecordatorios.
        var hoy = DateOnly.FromDateTime(FechaHoraGuatemala.DesdeUtc(_reloj.GetUtcNow()));
        var fechas = CalendarioRecordatorios.FechasObjetivo(hoy);

        if (dryRun)
        {
            return await ProcesarAsync(fechas, dryRun: true, ct);
        }

        // Sin espera: si ya hay una ejecución en curso, esta no envía nada.
        if (!await EjecucionEnCurso.WaitAsync(0, ct))
        {
            _logger.LogWarning("Recordatorios de {Fechas}: ya hay una ejecución en curso, se ignora esta llamada", Texto(fechas));
            return new RecordatorioResumenDto { FechasObjetivo = fechas.ToList(), EjecucionEnCurso = true };
        }

        try
        {
            return await ProcesarAsync(fechas, dryRun: false, ct);
        }
        finally
        {
            EjecucionEnCurso.Release();
        }
    }

    private async Task<RecordatorioResumenDto> ProcesarAsync(IReadOnlyList<DateOnly> fechas, bool dryRun, CancellationToken ct)
    {
        var resumen = new RecordatorioResumenDto { FechasObjetivo = fechas.ToList(), DryRun = dryRun };
        var citas = await ObtenerCitasSinRecordatorioAsync(fechas, dryRun, ct);
        resumen.TotalEncontradas = citas.Count;

        foreach (var cita in citas)
        {
            ct.ThrowIfCancellationRequested();

            var detalle = new RecordatorioDetalleDto
            {
                IdCita = cita.IdCita,
                NombrePaciente = PlantillaRecordatorio.Nombre(cita.Paciente.Nombres, cita.Paciente.Apellidos),
                TelefonoEnmascarado = TelefonoWhatsApp.Enmascarar(cita.Paciente.Telefono),
                Fecha = PlantillaRecordatorio.Fecha(cita.FechaInicio),
                Hora = PlantillaRecordatorio.Hora(cita.FechaInicio),
            };
            resumen.Detalle.Add(detalle);

            if (!cita.Paciente.AceptaRecordatoriosWhatsApp)
            {
                MarcarOmitida(resumen, detalle, MotivoSinConsentimiento);
                continue;
            }

            var telefono = TelefonoWhatsApp.Normalizar(cita.Paciente.Telefono);
            if (telefono is null)
            {
                MarcarOmitida(resumen, detalle, MotivoTelefonoInvalido);
                continue;
            }

            if (dryRun)
            {
                detalle.Resultado = RecordatorioResultados.PorEnviar;
                resumen.PorEnviar++;
                continue;
            }

            await EnviarAsync(cita, telefono, detalle, resumen, ct);
        }

        _logger.LogInformation(
            "Recordatorios de {Fechas} (dryRun={DryRun}): {Total} encontradas, {Enviadas} enviadas, {Fallidas} fallidas, {Omitidas} omitidas, {PorEnviar} por enviar",
            Texto(fechas), dryRun, resumen.TotalEncontradas, resumen.Enviadas, resumen.Fallidas, resumen.Omitidas, resumen.PorEnviar);

        return resumen;
    }

    // FechaInicio se guarda en hora local de Guatemala, así que cada fecha es el
    // rango [fecha 00:00, día siguiente 00:00) directamente sobre esa columna.
    // Las fechas objetivo son a lo sumo dos y no contiguas (viernes: sábado y
    // lunes), así que se consulta cada una por separado y se juntan en orden.
    private async Task<List<Cita>> ObtenerCitasSinRecordatorioAsync(IReadOnlyList<DateOnly> fechas, bool soloLectura, CancellationToken ct)
    {
        var citas = new List<Cita>();
        if (fechas.Count == 0)
        {
            return citas;
        }

        // Por nombre contra el catálogo (igual que CitaService), nunca por ID fijo.
        var idsEstados = await _db.EstadosCita
            .Where(e => e.TipoEstadoCita == EstadoPendiente || e.TipoEstadoCita == EstadoConfirmada)
            .Select(e => e.IdEstadoCita)
            .ToListAsync(ct);

        foreach (var fecha in fechas.Order())
        {
            var inicio = fecha.ToDateTime(TimeOnly.MinValue);
            var finExclusivo = inicio.AddDays(1);

            var query = _db.Citas
                .Include(c => c.Paciente)
                .Where(c => c.FechaInicio >= inicio && c.FechaInicio < finExclusivo
                    && idsEstados.Contains(c.IdEstadoCita)
                    && c.RecordatorioEnviadoEn == null)
                .OrderBy(c => c.FechaInicio)
                .ThenBy(c => c.IdCita);

            citas.AddRange(soloLectura
                ? await query.AsNoTracking().ToListAsync(ct)
                : await query.ToListAsync(ct));
        }

        return citas;
    }

    private static string Texto(IReadOnlyList<DateOnly> fechas) =>
        fechas.Count == 0 ? "(ninguna fecha)" : string.Join(", ", fechas.Select(f => f.ToString("yyyy-MM-dd")));

    private async Task EnviarAsync(Cita cita, string telefono, RecordatorioDetalleDto detalle, RecordatorioResumenDto resumen, CancellationToken ct)
    {
        try
        {
            var resultado = await _whatsApp.EnviarRecordatorioCitaAsync(telefono, detalle.NombrePaciente, detalle.Fecha, detalle.Hora, ct);

            if (resultado.Exitoso)
            {
                cita.RecordatorioEnviadoEn = FechaHoraGuatemala.Ahora();
                cita.RecordatorioMessageId = resultado.MessageId;
                cita.RecordatorioError = null;
                detalle.Resultado = RecordatorioResultados.Enviado;
                resumen.Enviadas++;
            }
            else
            {
                MarcarFallida(cita, detalle, resumen, resultado.Error ?? "Error desconocido al enviar por WhatsApp.");
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Un error inesperado en una cita no detiene las demás.
            _logger.LogError(ex, "Error inesperado al enviar el recordatorio de la cita {IdCita}", cita.IdCita);
            MarcarFallida(cita, detalle, resumen, $"Error inesperado: {ex.Message}");
        }

        // Se guarda después de cada cita: si el proceso se cae a la mitad, lo
        // ya enviado queda registrado y no se reenvía en la siguiente ejecución.
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Los cambios siguen en el change tracker y se reintentan en el
            // SaveChanges de la siguiente cita.
            _logger.LogError(ex, "No se pudo guardar el resultado del recordatorio de la cita {IdCita}", cita.IdCita);
            detalle.Motivo = Truncar($"{detalle.Motivo} No se pudo guardar el resultado: {ex.Message}".Trim());
        }
    }

    private static void MarcarOmitida(RecordatorioResumenDto resumen, RecordatorioDetalleDto detalle, string motivo)
    {
        detalle.Resultado = RecordatorioResultados.Omitido;
        detalle.Motivo = motivo;
        resumen.Omitidas++;
    }

    // RecordatorioEnviadoEn sigue en null: la cita se reintenta en la siguiente ejecución.
    private static void MarcarFallida(Cita cita, RecordatorioDetalleDto detalle, RecordatorioResumenDto resumen, string error)
    {
        var errorTruncado = Truncar(error);
        cita.RecordatorioError = errorTruncado;
        detalle.Resultado = RecordatorioResultados.Fallido;
        detalle.Motivo = errorTruncado;
        resumen.Fallidas++;
    }

    private static string Truncar(string texto) =>
        texto.Length <= LongitudMaximaError ? texto : texto[..LongitudMaximaError];
}
