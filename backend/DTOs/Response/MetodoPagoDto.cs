namespace Peredent.Api.DTOs.Response;

// SCRUM-276: opción del campo "Método de pago" al registrar un abono.
public class MetodoPagoDto
{
    public int IdMetodoPago { get; set; }

    public string Nombre { get; set; } = string.Empty;
}
