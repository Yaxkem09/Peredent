using Peredent.Api.DTOs.Response;

namespace Peredent.Api.Services;

public interface IPresupuestoPdfService
{
    // SCRUM-78: arma el presupuesto del paciente como PDF y devuelve los bytes
    // listos para descargar.
    byte[] Generar(PresupuestoDto presupuesto);
}
