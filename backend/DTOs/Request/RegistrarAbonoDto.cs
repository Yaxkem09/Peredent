namespace Peredent.Api.DTOs.Request;

// SCRUM-64: el cliente solo manda el monto. La fecha la asigna el backend (hora
// de Guatemala) y el usuario sale del token, no del cuerpo de la petición.
public class RegistrarAbonoDto
{
    public decimal Monto { get; set; }
}
