using System.Globalization;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Peredent.Api.Services;

// SCRUM-294/301: constancia odontológica en PDF. Hay dos plantillas según el
// tipo ("Extracción de terceras molares" y "Tratamiento realizado"); el texto
// fijo va tal cual y los datos llenados (paciente, fecha, procedimiento,
// días de reposo) en negrita, como en las constancias hechas a mano. El texto
// debe coincidir con frontend/src/pages/Pacientes/ConstanciaForm.jsx.
public class ConstanciaPdfService : IConstanciaPdfService
{
    private static readonly CultureInfo Cultura = CultureInfo.InvariantCulture;

    private const string ColorTexto = "#111827";
    private const string ColorTenue = "#6B7280";
    private const string ColorLineaFirma = "#4B5563";
    private const float TamanoTexto = 12f;

    // Meses en español a mano: no depende de que el servidor tenga datos de
    // cultura "es" instalados (contenedores con globalización invariante).
    private static readonly string[] Meses =
    {
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    };

    private static readonly byte[]? Logo = CargarLogo();

    static ConstanciaPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private static byte[]? CargarLogo()
    {
        var ruta = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-peredent.png");
        return File.Exists(ruta) ? File.ReadAllBytes(ruta) : null;
    }

    public byte[] Generar(ConstanciaDto constancia)
    {
        return Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.Letter);
                page.MarginHorizontal(72);
                page.MarginVertical(48);
                page.DefaultTextStyle(t => t.FontSize(TamanoTexto).FontColor(ColorTexto).LineHeight(1.5f));

                page.Header().Element(Encabezado);
                page.Content().PaddingTop(24).Element(c => Cuerpo(c, constancia));
            });
        }).GeneratePdf();
    }

    private static bool EsExtraccion(ConstanciaDto c) =>
        c.TipoConstancia == TipoConstanciaMedica.NombreExtraccionTercerasMolares;

    // Logo grande para que se lean las especialidades y los nombres que trae
    // debajo de "PEREDENT".
    private static void Encabezado(IContainer container)
    {
        if (Logo is not null)
        {
            container.AlignCenter().Height(150).Image(Logo).FitHeight();
        }
    }

    private static void Cuerpo(IContainer container, ConstanciaDto c)
    {
        var articulo = Articulo(c.SexoPaciente);

        container.Column(col =>
        {
            col.Spacing(14);

            col.Item().PaddingBottom(10).AlignCenter().Text("CONSTANCIA ODONTOLÓGICA").FontSize(15).Bold();

            col.Item().Text(t =>
            {
                t.Justify();
                t.Span($"Por medio de la presente, se hace constar que {articulo.Paciente} ");
                t.Span(c.NombrePaciente).Bold();
                t.Span($", fue {articulo.Atendido} en esta clínica el día ");
                t.Span(FechaLarga(c.FechaAtencion)).Bold();

                if (EsExtraccion(c))
                {
                    t.Span(", para la realización de un procedimiento quirúrgico de ");
                    t.Span("extracción de tercera(s) molar(es)").Bold();
                    t.Span(".");
                }
                else
                {
                    t.Span(", para la realización de un procedimiento odontológico consistente en:");
                }
            });

            if (!EsExtraccion(c))
            {
                col.Item().PaddingLeft(24).Column(tr =>
                {
                    tr.Item().Text("Tratamiento realizado:").Bold();
                    tr.Item().Text(c.TratamientoRealizado ?? string.Empty).Bold();
                });
            }

            col.Item().Text(t =>
            {
                t.Justify();
                if (EsExtraccion(c))
                {
                    t.Span("Debido a la naturaleza del procedimiento realizado, se recomienda ");
                    if (c.DiasReposo > 0)
                    {
                        t.Span("reposo relativo durante un período de ");
                        t.Span(TextoDias(c.DiasReposo)).Bold();
                        t.Span(", a partir de la fecha indicada, así como ");
                    }
                    t.Span("evitar actividades físicas intensas y seguir las indicaciones postoperatorias proporcionadas.");
                }
                else
                {
                    t.Span("La atención odontológica se llevó a cabo en la fecha y horario correspondientes.");
                    if (c.DiasReposo > 0)
                    {
                        t.Span(" Debido a la naturaleza del procedimiento realizado, se recomienda reposo relativo durante un período de ");
                        t.Span(TextoDias(c.DiasReposo)).Bold();
                        t.Span(".");
                    }
                }
            });

            col.Item().Text(t =>
            {
                t.Justify();
                t.Span($"Se extiende la presente constancia a solicitud {articulo.Interesado}, para los usos que estime convenientes.");
            });

            col.Item().PaddingTop(6).Text(t =>
            {
                t.Span("Lugar y fecha de emisión: ");
                var fecha = FechaLarga(c.FechaEmision);
                t.Span(string.IsNullOrWhiteSpace(c.LugarEmision) ? fecha : $"{c.LugarEmision.Trim()}, {fecha}").Bold();
            });

            col.Item().PaddingTop(6).Text("Atentamente,");

            // Firma: el espacio queda en blanco para firmar y sellar a mano.
            col.Item().PaddingTop(70).ShowEntire().AlignCenter().Width(280).Element(f => Firma(f, c));
        });
    }

    private static void Firma(IContainer container, ConstanciaDto c)
    {
        var doctor = c.Doctor;
        var nombre = doctor is null ? string.Empty : $"{doctor.Nombres} {doctor.Apellidos}".Trim();
        var especialidad = EsExtraccion(c) ? "Cirujano Oral y Maxilofacial" : "Odontólogo(a)";

        container.Column(col =>
        {
            col.Item().LineHorizontal(0.8f).LineColor(ColorLineaFirma);
            col.Item().PaddingTop(4).AlignCenter().Text(string.IsNullOrEmpty(nombre) ? "Dr." : $"Dr. {nombre}").Bold();
            col.Item().AlignCenter().Text(especialidad).FontSize(10.5f);
            col.Item().AlignCenter().Text($"Colegiado No. {doctor?.Colegiado}".TrimEnd()).FontSize(10.5f);
            col.Item().AlignCenter().Text($"Teléfono: {doctor?.Telefono}".TrimEnd()).FontSize(10.5f);
            col.Item().PaddingTop(2).AlignCenter().Text("Firma y sello profesional").FontSize(9).FontColor(ColorTenue);
        });
    }

    // "el paciente / atendido / del interesado" según el sexo registrado; si
    // no hay sexo se usa la forma neutra de la plantilla.
    private static (string Paciente, string Atendido, string Interesado) Articulo(string? sexo) => sexo switch
    {
        "Femenino" => ("la paciente", "atendida", "de la interesada"),
        "Masculino" => ("el paciente", "atendido", "del interesado"),
        _ => ("el/la paciente", "atendido(a)", "del/de la interesado(a)"),
    };

    private static string TextoDias(int dias) => dias == 1 ? "1 día" : $"{dias.ToString(Cultura)} días";

    private static string FechaLarga(DateTime fecha) =>
        $"{fecha.Day.ToString(Cultura)} de {Meses[fecha.Month - 1]} de {fecha.Year.ToString(Cultura)}";
}
