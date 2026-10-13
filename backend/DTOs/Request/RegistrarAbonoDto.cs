namespace Peredent.Api.DTOs.Request;

// SCRUM-64: el cliente solo manda el monto. La fecha la asigna el backend (hora
// de Guatemala) y el usuario sale del token, no del cuerpo de la petición.
public class RegistrarAbonoDto
{
    public decimal Monto { get; set; }

    // Plan sobre el que se abona. Opcional: si no viene se usa el plan activo.
    // Permite abonar también a un plan ya cerrado que quedó con saldo pendiente.
    public int? IdPresupuestoPlan { get; set; }
}
