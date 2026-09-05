using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;

namespace Peredent.Api.Services;

public class CitaService : ICitaService
{
    private const string EstadoPendiente = "Pendiente";
    private const string EstadoCancelada = "Cancelada";
    private const string EstadoAtendida = "Atendida";
    private const string EstadoNoAsistio = "No Asistio";

    private readonly ApplicationDbContext _db;

    public CitaService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<List<CitaDto>> GetByRangoAsync(DateOnly desde, DateOnly hasta)
    {
        var inicio = desde.ToDateTime(TimeOnly.MinValue);
        var finExclusivo = hasta.ToDateTime(TimeOnly.MinValue).AddDays(1);

        var citas = await ConQuery()
            .Where(c => c.FechaInicio >= inicio && c.FechaInicio < finExclusivo)
            .OrderBy(c => c.FechaInicio)
            .ToListAsync();

        return citas.Select(ToDto).ToList();
    }

    public Task<List<EstadoCitaDto>> GetEstadosAsync() =>
        _db.EstadosCita
            .OrderBy(e => e.IdEstadoCita)
            .Select(e => new EstadoCitaDto { Id = e.IdEstadoCita, Nombre = e.TipoEstadoCita })
            .ToListAsync();

    public async Task<CitaDto?> GetByIdAsync(int idCita)
    {
        var cita = await ConQuery().FirstOrDefaultAsync(c => c.IdCita == idCita);
        return cita is null ? null : ToDto(cita);
    }

    public async Task<CitaResultado> CrearAsync(CreateCitaDto request)
    {
        var paciente = await _db.Pacientes.FindAsync(request.IdPaciente);
        if (paciente is null)
        {
            return CitaResultado.Fallo(CitaError.PacienteNoEncontrado, "El paciente indicado no existe.");
        }

        var dentista = await _db.Usuarios.FindAsync(request.IdUsuario);
        if (dentista is null)
        {
            return CitaResultado.Fallo(CitaError.DentistaNoEncontrado, "El odontólogo indicado no existe.");
        }

        if (request.Fecha < DateOnly.FromDateTime(AhoraGuatemala()))
        {
            return CitaResultado.Fallo(CitaError.FechaEnElPasado, "No se puede crear una cita en una fecha ya pasada.");
        }

        if (!CitaConstantes.DuracionesPermitidas.Contains(request.DuracionMinutos))
        {
            return CitaResultado.Fallo(CitaError.DuracionInvalida, MensajeDuracionInvalida);
        }

        if (!EstaDentroDelHorario(request.Hora, request.DuracionMinutos))
        {
            return CitaResultado.Fallo(CitaError.FueraDeHorarioAtencion, MensajeFueraDeHorario);
        }

        var fechaInicio = request.Fecha.ToDateTime(request.Hora);
        var fechaFin = fechaInicio.AddMinutes(request.DuracionMinutos);

        if (await HayConflictoHorarioAsync(request.IdUsuario, fechaInicio, fechaFin, idCitaExcluir: null))
        {
            return CitaResultado.Fallo(CitaError.ConflictoHorario, "Ese horario se cruza con otra cita.");
        }

        var idEstadoPendiente = await ObtenerIdEstadoAsync(EstadoPendiente);
        if (idEstadoPendiente is null)
        {
            return CitaResultado.Fallo(CitaError.EstadoInvalido, "El catálogo de estados de cita no está sembrado en la base de datos.");
        }

        var cita = new Cita
        {
            IdPaciente = request.IdPaciente,
            IdUsuario = request.IdUsuario,
            IdEstadoCita = idEstadoPendiente.Value,
            FechaInicio = fechaInicio,
            FechaFin = fechaFin,
            NotasAdicionales = request.NotasAdicionales,
        };

        _db.Citas.Add(cita);
        await _db.SaveChangesAsync();

        return CitaResultado.Ok(await ObtenerDtoAsync(cita.IdCita));
    }

    public async Task<CitaResultado> ActualizarAsync(int idCita, UpdateCitaDto request)
    {
        var cita = await _db.Citas.FirstOrDefaultAsync(c => c.IdCita == idCita);
        if (cita is null)
        {
            return CitaResultado.Fallo(CitaError.CitaNoEncontrada, "La cita indicada no existe.");
        }

        var paciente = await _db.Pacientes.FindAsync(request.IdPaciente);
        if (paciente is null)
        {
            return CitaResultado.Fallo(CitaError.PacienteNoEncontrado, "El paciente indicado no existe.");
        }

        var dentista = await _db.Usuarios.FindAsync(request.IdUsuario);
        if (dentista is null)
        {
            return CitaResultado.Fallo(CitaError.DentistaNoEncontrado, "El odontólogo indicado no existe.");
        }

        var estadoExiste = await _db.EstadosCita.AnyAsync(e => e.IdEstadoCita == request.IdEstadoCita);
        if (!estadoExiste)
        {
            return CitaResultado.Fallo(CitaError.EstadoInvalido, "El estado de cita indicado no existe.");
        }

        var ahoraGuatemala = AhoraGuatemala();

        // Solo evaluamos "fecha pasada" cuando el request realmente intenta mover
        // la fecha/hora: reenviar sin cambios la fecha ya pasada de una cita
        // histórica (para solo tocar Estado o Notas) debe seguir permitido.
        var cambiaFechaOHora = request.Fecha != DateOnly.FromDateTime(cita.FechaInicio)
            || request.Hora != TimeOnly.FromDateTime(cita.FechaInicio);

        if (cambiaFechaOHora && request.Fecha < DateOnly.FromDateTime(ahoraGuatemala))
        {
            return CitaResultado.Fallo(CitaError.FechaEnElPasado, "No se puede mover una cita a una fecha ya pasada.");
        }

        // Una cita cuya fecha original ya pasó queda como historial: no se puede
        // reprogramar (aunque sí se le puede seguir cambiando estado o notas).
        var esHistorial = cita.FechaInicio.Date < ahoraGuatemala.Date;
        if (esHistorial && cambiaFechaOHora)
        {
            return CitaResultado.Fallo(CitaError.FechaEnElPasado, "Esta cita ya pasó; no se puede reprogramar su fecha u hora.");
        }

        if (!CitaConstantes.DuracionesPermitidas.Contains(request.DuracionMinutos))
        {
            return CitaResultado.Fallo(CitaError.DuracionInvalida, MensajeDuracionInvalida);
        }

        if (!EstaDentroDelHorario(request.Hora, request.DuracionMinutos))
        {
            return CitaResultado.Fallo(CitaError.FueraDeHorarioAtencion, MensajeFueraDeHorario);
        }

        var fechaInicio = request.Fecha.ToDateTime(request.Hora);
        var fechaFin = fechaInicio.AddMinutes(request.DuracionMinutos);

        if (await HayConflictoHorarioAsync(request.IdUsuario, fechaInicio, fechaFin, idCitaExcluir: idCita))
        {
            return CitaResultado.Fallo(CitaError.ConflictoHorario, "Ese horario se cruza con otra cita.");
        }

        if (await EsTransicionAEstadoYaOcurridoAsync(request.IdEstadoCita) && fechaInicio > ahoraGuatemala)
        {
            return CitaResultado.Fallo(CitaError.EstadoNoDisponibleAun, "No se puede marcar Atendida o No Asistió antes de que llegue la hora de la cita.");
        }

        cita.IdPaciente = request.IdPaciente;
        cita.IdUsuario = request.IdUsuario;
        cita.IdEstadoCita = request.IdEstadoCita;
        cita.FechaInicio = fechaInicio;
        cita.FechaFin = fechaFin;
        cita.NotasAdicionales = request.NotasAdicionales;

        await _db.SaveChangesAsync();

        return CitaResultado.Ok(await ObtenerDtoAsync(cita.IdCita));
    }

    public async Task<CitaResultado> CancelarAsync(int idCita)
    {
        var cita = await _db.Citas.FirstOrDefaultAsync(c => c.IdCita == idCita);
        if (cita is null)
        {
            return CitaResultado.Fallo(CitaError.CitaNoEncontrada, "La cita indicada no existe.");
        }

        var idEstadoCancelada = await ObtenerIdEstadoAsync(EstadoCancelada);
        if (idEstadoCancelada is null)
        {
            return CitaResultado.Fallo(CitaError.EstadoInvalido, "El catálogo de estados de cita no está sembrado en la base de datos.");
        }

        // Soft-cancel: solo cambia el estado, el registro nunca se borra.
        cita.IdEstadoCita = idEstadoCancelada.Value;
        await _db.SaveChangesAsync();

        return CitaResultado.Ok(await ObtenerDtoAsync(cita.IdCita));
    }

    private static readonly string MensajeFueraDeHorario =
        $"El horario de atención es de {CitaConstantes.HoraAperturaClinica}:00 a {CitaConstantes.HoraCierreClinica}:00.";

    private static readonly string MensajeDuracionInvalida =
        $"La duración de la cita debe ser de {string.Join(" o ", CitaConstantes.DuracionesPermitidas)} minutos.";

    private static bool EstaDentroDelHorario(TimeOnly hora, int duracionMinutos)
    {
        var apertura = new TimeOnly(CitaConstantes.HoraAperturaClinica, 0);
        var cierre = new TimeOnly(CitaConstantes.HoraCierreClinica, 0);

        return hora >= apertura && hora.AddMinutes(duracionMinutos) <= cierre;
    }

    // Dos citas del mismo odontólogo, el mismo día, conflictúan si sus bloques
    // [inicio, fin) se traslapan — ya no se puede asumir que todas duran 30 minutos,
    // así que se compara el intervalo real de cada una. Las citas Canceladas no
    // cuentan (el horario queda libre otra vez).
    private async Task<bool> HayConflictoHorarioAsync(int idUsuario, DateTime fechaInicio, DateTime fechaFin, int? idCitaExcluir)
    {
        var idEstadoCancelada = await ObtenerIdEstadoAsync(EstadoCancelada);

        var inicioDia = fechaInicio.Date;
        var finDia = inicioDia.AddDays(1);

        var citasDelDia = await _db.Citas
            .Where(c => c.IdUsuario == idUsuario
                && c.FechaInicio >= inicioDia && c.FechaInicio < finDia
                && c.IdEstadoCita != idEstadoCancelada
                && (idCitaExcluir == null || c.IdCita != idCitaExcluir))
            .Select(c => new { c.FechaInicio, c.FechaFin })
            .ToListAsync();

        return citasDelDia.Any(existente => existente.FechaInicio < fechaFin && fechaInicio < existente.FechaFin);
    }

    // Hora actual en Guatemala (UTC-6, sin horario de verano). Autoridad para
    // "fecha pasada" y "todavía no llega la hora": el navegador puede estar en
    // otra zona horaria, pero el backend siempre decide con esta referencia.
    private static DateTime AhoraGuatemala() => DateTime.UtcNow.AddHours(-6);

    // Compara por IdEstadoCita contra el catálogo (nunca por el string del
    // nombre): "No Asistio" no lleva tilde y una diferencia de tilde/mayúsculas
    // en el nombre no debe romper este chequeo en silencio.
    private async Task<bool> EsTransicionAEstadoYaOcurridoAsync(int idEstadoCita)
    {
        var idAtendida = await ObtenerIdEstadoAsync(EstadoAtendida);
        var idNoAsistio = await ObtenerIdEstadoAsync(EstadoNoAsistio);

        return idEstadoCita == idAtendida || idEstadoCita == idNoAsistio;
    }

    private Task<int?> ObtenerIdEstadoAsync(string nombre) =>
        _db.EstadosCita
            .Where(e => e.TipoEstadoCita == nombre)
            .Select(e => (int?)e.IdEstadoCita)
            .FirstOrDefaultAsync();

    private async Task<CitaDto> ObtenerDtoAsync(int idCita) =>
        ToDto(await ConQuery().FirstAsync(c => c.IdCita == idCita));

    private IQueryable<Cita> ConQuery() =>
        _db.Citas
            .Include(c => c.Paciente)
            .Include(c => c.Usuario)
            .Include(c => c.EstadoCita);

    private static CitaDto ToDto(Cita cita) => new()
    {
        IdCita = cita.IdCita,
        IdPaciente = cita.IdPaciente,
        NombrePaciente = $"{cita.Paciente.Nombres} {cita.Paciente.Apellidos}",
        IdUsuario = cita.IdUsuario,
        NombreOdontologo = cita.Usuario.NombreUsuario,
        Fecha = DateOnly.FromDateTime(cita.FechaInicio),
        Hora = TimeOnly.FromDateTime(cita.FechaInicio),
        DuracionMinutos = (int)(cita.FechaFin - cita.FechaInicio).TotalMinutes,
        NotasAdicionales = cita.NotasAdicionales,
        IdEstadoCita = cita.IdEstadoCita,
        Estado = cita.EstadoCita.TipoEstadoCita,
    };
}
