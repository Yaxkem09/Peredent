namespace Peredent.Api.Models;

// SCRUM-263/264: cada vez que se imprime un consentimiento queda registrado
// quién lo imprimió y cuándo (también las reimpresiones tras corregirlo).
public class ConsentimientoImpresion
{
    public int IdConsentimientoImpresion { get; set; }

    public int IdConsentimiento { get; set; }

    public int IdUsuario { get; set; }

    public DateTime FechaImpresion { get; set; }

    public Usuario? Usuario { get; set; }
}
