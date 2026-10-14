namespace Peredent.Api.Models;

// SCRUM-298: catálogo de tipos de constancia. Cada tipo tiene su plantilla
// fija en ConstanciaPdfService (y en el formulario del frontend); se
// identifican por nombre porque los ID son IDENTITY y dependen del orden de
// carga del script.
public class TipoConstanciaMedica
{
    public const string NombreExtraccionTercerasMolares = "Extracción de terceras molares";
    public const string NombreTratamientoRealizado = "Tratamiento realizado";

    public int IdTipoConstanciaMedica { get; set; }

    public string NombreConstancia { get; set; } = string.Empty;
}
