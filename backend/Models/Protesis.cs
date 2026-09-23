namespace Peredent.Api.Models;

public class Protesis
{
    public int IdProtesis { get; set; }
    public int IdPaciente { get; set; }
    public bool PPF { get; set; }
    public bool PPRSup { get; set; }
    public bool PPRInf { get; set; }
    public bool PTSup { get; set; }
    public bool PTInf { get; set; }
    public string? ObservacionesProtesis { get; set; }
}