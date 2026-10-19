namespace Peredent.Api.DTOs.Response;

// SCRUM-270 / SCRUM-271: pagos (abonos no anulados) recibidos en el día y en la
// semana (la actual o una anterior), para el dashboard del odontólogo.
public class ResumenPagosDto
{
    public PeriodoPagosDto Hoy { get; set; } = new();

    public PeriodoPagosDto Semana { get; set; } = new();

    // true cuando la semana consultada es la actual (no hay semana siguiente).
    public bool EsSemanaActual { get; set; }

    // Cada día de la semana consultada (lunes a domingo), para poder ver en el
    // dashboard otro día además de hoy.
    public List<PeriodoPagosDto> Dias { get; set; } = new();
}

public class PeriodoPagosDto
{
    // Días de calendario (inclusive) que abarca el periodo, en hora de Guatemala.
    public DateTime Desde { get; set; }

    public DateTime Hasta { get; set; }

    public decimal Total { get; set; }

    public int CantidadPagos { get; set; }

    // SCRUM-272: desglose por método de pago. Trae todos los métodos del
    // catálogo, también los que no tuvieron pagos (en 0).
    public List<PagosPorMetodoDto> PorMetodo { get; set; } = new();
}

public class PagosPorMetodoDto
{
    public int IdMetodoPago { get; set; }

    public string MetodoPago { get; set; } = string.Empty;

    public decimal Total { get; set; }

    public int CantidadPagos { get; set; }
}
