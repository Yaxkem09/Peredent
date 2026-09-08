using Peredent.Api.Models;

namespace Peredent.Api.DTOs.Request;

public class UpdateCitaDto
{
    public int IdPaciente { get; set; }

    public int IdUsuario { get; set; }

    public DateOnly Fecha { get; set; }

    public TimeOnly Hora { get; set; }

    public int DuracionMinutos { get; set; } = CitaConstantes.DuracionMinutos;

    public string? NotasAdicionales { get; set; }

    public int IdEstadoCita { get; set; }
}
