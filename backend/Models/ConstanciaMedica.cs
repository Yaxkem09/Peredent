namespace Peredent.Api.Models;

// SCRUM-299: constancia odontológica emitida a un paciente. Solo guarda los
// campos variables de la plantilla; el texto fijo está en
// ConstanciaPdfService. Una constancia emitida no se edita (SCRUM-302).
// Los datos del odontólogo (nombre, colegiado, teléfono) no se copian aquí:
// se toman de su DatosRecetario más reciente, así que salen actualizados.
public class ConstanciaMedica
{
    public int IdConstanciaMedica { get; set; }

    public int IdPaciente { get; set; }

    public int IdTipoConstanciaMedica { get; set; }

    // Odontólogo que la emitió.
    public int IdUsuario { get; set; }

    public DateTime FechaAtencionConstancia { get; set; }

    public int DiasReposo { get; set; }

    // Solo para el tipo "Tratamiento realizado".
    public string? TratamientoRealizadoConstancia { get; set; }

    public string? LugarEmisionConstancia { get; set; }

    public DateTime FechaEmisionConstancia { get; set; }

    public Paciente? Paciente { get; set; }

    public TipoConstanciaMedica? TipoConstanciaMedica { get; set; }
}
