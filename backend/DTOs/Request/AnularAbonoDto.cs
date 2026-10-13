namespace Peredent.Api.DTOs.Request;

// Anulación de un abono (solo admin). La contraseña es la del propio admin logueado:
// se vuelve a pedir como confirmación de una acción que no se puede deshacer.
// El motivo es opcional.
public class AnularAbonoDto
{
    public string? Password { get; set; }

    public string? Motivo { get; set; }
}
