namespace Peredent.Api.DTOs.Response;

public class BloqueoAgendaDto
{
    public int IdBloqueoAgenda { get; set; }

    public int IdUsuario { get; set; }

    public string NombreOdontologo { get; set; } = string.Empty;

    public DateOnly Fecha { get; set; }

    public string? Motivo { get; set; }
}
