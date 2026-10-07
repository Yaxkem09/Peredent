namespace Peredent.Api.DTOs.Request;

// Edición del monto de un abono (solo admin). La contraseña es la del propio admin
// logueado: se vuelve a pedir como confirmación porque cambia el saldo del paciente.
public class EditarAbonoDto
{
    public decimal Monto { get; set; }

    public string? Password { get; set; }
}
