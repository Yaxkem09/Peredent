namespace Peredent.Api.Models;

// SCRUM-103: un medicamento indicado dentro de una receta (puede haber varios
// por receta).
public class MedicamentoReceta
{
    public int IdMedicamentosReceta { get; set; }

    public int IdRecetario { get; set; }

    public string Nombre { get; set; } = string.Empty;

    public string PresentacionReceta { get; set; } = string.Empty;

    public string IndicacionesReceta { get; set; } = string.Empty;
}
