using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;

namespace Peredent.Api.Services;

public class PlanTratamientoService : IPlanTratamientoService
{
    private const string EstadoPendiente = "Pendiente";
    private const string EstadoCompletado = "Completado";

    // Guatemala es UTC-6 todo el año (no observa horario de verano), así que un
    // offset fijo evita depender de que el servidor tenga cargada la zona horaria.
    private static DateTime FechaHoyGuatemala() => DateTime.UtcNow.AddHours(-6).Date;

    private readonly ApplicationDbContext _db;

    public PlanTratamientoService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<PlanTratamientoResultado> ObtenerPendientesPorPacienteAsync(int pacienteId)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return PlanTratamientoResultado.Fallo(PlanTratamientoError.PacienteNoEncontrado, "Paciente no encontrado.");
        }

        var planActivo = await ObtenerPlanActivoAsync(pacienteId);

        return PlanTratamientoResultado.Ok(ObtenerPendientes(planActivo));
    }

    public async Task<PlanTratamientoResultado> MarcarComoCompletadoAsync(int pacienteId, string pieza)
    {
        var paciente = await _db.Pacientes.FindAsync(pacienteId);
        if (paciente is null)
        {
            return PlanTratamientoResultado.Fallo(PlanTratamientoError.PacienteNoEncontrado, "Paciente no encontrado.");
        }

        var planActivo = await ObtenerPlanActivoAsync(pacienteId);
        if (planActivo is null)
        {
            return PlanTratamientoResultado.Fallo(PlanTratamientoError.PlanActivoNoEncontrado, "Este paciente no tiene un plan de tratamiento activo.");
        }

        // Único por (IdPresupuestoPlan, Pieza) a nivel de base de datos (ver
        // ApplicationDbContext), así que dentro del plan activo hay a lo mucho una fila por pieza.
        var fila = planActivo.Piezas.FirstOrDefault(pt => pt.Pieza == pieza);
        if (fila is null)
        {
            return PlanTratamientoResultado.Fallo(
                PlanTratamientoError.PiezaNoEncontrada,
                $"La pieza {pieza} no está en el plan de tratamiento activo de este paciente.");
        }

        var idEstadoCompletado = await ObtenerIdEstadoAsync(EstadoCompletado);
        if (idEstadoCompletado is null)
        {
            return PlanTratamientoResultado.Fallo(
                PlanTratamientoError.CatalogoEstadosNoSembrado,
                "El catálogo de estados de tratamiento no está sembrado en la base de datos.");
        }

        fila.IdEstadoTratamiento = idEstadoCompletado.Value;
        fila.FechaFinTratamiento = FechaHoyGuatemala();
        await _db.SaveChangesAsync();

        return PlanTratamientoResultado.Ok(ObtenerPendientes(planActivo));
    }

    private Task<PresupuestoPlan?> ObtenerPlanActivoAsync(int pacienteId) =>
        _db.PresupuestosPlan
            .Include(p => p.Piezas).ThenInclude(pt => pt.EstadoTratamiento)
            .FirstOrDefaultAsync(p => p.IdPaciente == pacienteId && p.FechaCierre == null);

    private Task<int?> ObtenerIdEstadoAsync(string nombre) =>
        _db.EstadosTratamiento
            .Where(e => e.Nombre == nombre)
            .Select(e => (int?)e.IdEstadoTratamiento)
            .FirstOrDefaultAsync();

    private static List<TratamientoPendienteDto> ObtenerPendientes(PresupuestoPlan? presupuesto) =>
        presupuesto?.Piezas
            .Where(pt => pt.EstadoTratamiento?.Nombre == EstadoPendiente)
            .OrderBy(pt => pt.FechaRegistroPlan)
            .Select(pt => new TratamientoPendienteDto
            {
                Pieza = pt.Pieza,
                Tratamiento = pt.Tratamiento,
                Valor = pt.Valor,
                FechaRegistroPlan = pt.FechaRegistroPlan,
            })
            .ToList() ?? new List<TratamientoPendienteDto>();
}
