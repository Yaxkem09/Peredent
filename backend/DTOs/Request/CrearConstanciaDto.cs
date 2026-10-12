namespace Peredent.Api.DTOs.Request;

// SCRUM-294: campos que llena el odontólogo al emitir una constancia. El
// tratamiento realizado solo es obligatorio para el tipo "Tratamiento
// realizado". No hay DTO de edición: una constancia emitida no se modifica.
public class CrearConstanciaDto
{
    public int? IdTipoConstanciaMedica { get; set; }

    public DateTime? FechaAtencion { get; set; }

    public int? DiasReposo { get; set; }

    public string? TratamientoRealizado { get; set; }

    public string? LugarEmision { get; set; }
}
