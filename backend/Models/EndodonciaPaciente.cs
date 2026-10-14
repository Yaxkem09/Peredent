namespace Peredent.Api.Models;

// Datos generales de endodoncia del paciente: un registro por paciente
// (ID_Paciente es la PK), así se guardan aunque no haya piezas registradas.
public class EndodonciaPaciente
{
    public int IdPaciente { get; set; }
    public bool TxPeriodontal { get; set; }
    public string? ObservacionesTxPeriodontal { get; set; }
    public string? ObservacionesEndodoncia { get; set; }
}
