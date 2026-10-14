namespace Peredent.Api.DTOs.Response;

// SCRUM-300/301: constancia tal como se lista en el expediente y se pasa al
// generador del PDF. Doctor es null si el odontólogo que la emitió no tiene
// DatosRecetario.
public class ConstanciaDto
{
    public int IdConstancia { get; set; }

    public int IdPaciente { get; set; }

    public string NombrePaciente { get; set; } = string.Empty;

    public string? SexoPaciente { get; set; }

    public int IdTipoConstancia { get; set; }

    public string TipoConstancia { get; set; } = string.Empty;

    public DateTime FechaAtencion { get; set; }

    public int DiasReposo { get; set; }

    public string? TratamientoRealizado { get; set; }

    public string? LugarEmision { get; set; }

    public DateTime FechaEmision { get; set; }

    public DatosOdontologoRespuestaDto? Doctor { get; set; }
}

public class TipoConstanciaDto
{
    public int IdTipoConstancia { get; set; }

    public string Nombre { get; set; } = string.Empty;
}

// Lo que necesita el formulario de "Nueva constancia": los tipos, los datos
// del odontólogo en sesión para el pie (null si aún no los registró en el
// recetario) y el lugar de su última constancia para precargarlo.
public class DatosNuevaConstanciaDto
{
    public List<TipoConstanciaDto> Tipos { get; set; } = new();

    public DatosOdontologoRespuestaDto? Doctor { get; set; }

    public string? Lugar { get; set; }
}
