namespace Peredent.Api.Models;

// SCRUM-291: catálogo de métodos de pago de un abono (tabla dbo.MetodoPago de
// PeredentScript_Sprint5.sql), cargado con "Efectivo" y "Transferencia".
public class MetodoPago
{
    public int IdMetodoPago { get; set; }

    public string NombreMetodoPago { get; set; } = string.Empty;
}
