namespace Peredent.Api.Models;

// SCRUM-92: cabecera de una receta médica emitida a un paciente.
public class Recetario
{
    public int IdRecetario { get; set; }

    public int IdPaciente { get; set; }

    public int IdDatosRecetario { get; set; }

    public DateTime FechaEmisionRecetario { get; set; }

    public string? NotasAdicionalesRecetario { get; set; }

    public Paciente? Paciente { get; set; }

    public DatosRecetario? DatosRecetario { get; set; }

    public List<MedicamentoReceta> Medicamentos { get; set; } = new();
}
