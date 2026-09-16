namespace Peredent.Api.DTOs.Request;

public class CreateBloqueoAgendaDto
{
    public DateOnly Fecha { get; set; }

    public string? Motivo { get; set; }
}
