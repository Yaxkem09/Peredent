namespace Peredent.Api.Models;

public class BloqueoAgenda
{
    public int IdBloqueoAgenda { get; set; }

    public int IdUsuario { get; set; }

    public DateOnly Fecha { get; set; }

    public string? Motivo { get; set; }

    public DateTime CreadoEn { get; set; }

    public Usuario Usuario { get; set; } = null!;
}
