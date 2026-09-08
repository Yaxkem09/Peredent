namespace Peredent.Api.DTOs.Response;

public class TratamientoPendienteDto
{
    public string Pieza { get; set; } = string.Empty;

    public string Tratamiento { get; set; } = string.Empty;

    public decimal Valor { get; set; }

    public DateTime FechaRegistroPlan { get; set; }
}
