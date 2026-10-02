using System.Globalization;
using Peredent.Api.DTOs.Response;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Peredent.Api.Services;

// SCRUM-254/262: consentimiento informado de exodoncia quirúrgica de terceros
// molares. Reproduce el formato de la SECOM con el logo de Peredent en lugar
// del de la sociedad: el texto fijo va tal cual y los campos llenados se
// colocan en su lugar (en negrita). Los campos opcionales vacíos se imprimen
// como línea punteada para completarlos a mano; solo los espacios de firma
// (paciente/representante, médico y testigo) quedan siempre en blanco.
public class ConsentimientoPdfService : IConsentimientoPdfService
{
    private static readonly CultureInfo Cultura = CultureInfo.InvariantCulture;

    private const string ColorTexto = "#111827";
    private const string ColorTenue = "#6B7280";
    private const string ColorLineaFirma = "#4B5563";
    private const float TamanoTexto = 10.5f;

    // Meses en español a mano: no depende de que el servidor tenga datos de
    // cultura "es" instalados (contenedores con globalización invariante).
    private static readonly string[] Meses =
    {
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    };

    private static readonly string[] Complicaciones =
    {
        "Alergia al anestésico u otro medicamento utilizado, antes, durante o después de la cirugía.",
        "Hematoma e hinchazón de la región.",
        "Hemorragia postoperatoria.",
        "Apertura de los puntos de sutura.",
        "Daño a los dientes vecinos.",
        "Falta de sensibilidad parcial o total, temporal o permanente del nervio dentario inferior (sensibilidad del labio inferior).",
        "Falta de sensibilidad parcial o total del nervio lingual, temporal o definitiva (de la lengua y del gusto).",
        "Falta de sensibilidad parcial o total del nervio infraorbitario (de la mejilla), temporal o definitiva.",
        "Infección de los tejidos o del hueso.",
        "Sinusitis.",
        "Comunicación entre la boca y la nariz o los senos maxilares.",
        "Fracturas óseas.",
        "Desplazamiento de dientes a estructuras vecinas.",
        "Tragado o aspiración de dientes o de alguna de sus partes.",
        "Rotura de instrumentos. Rotura de la aguja de anestesia.",
        "Infección de los puntos de sutura.",
    };

    private static readonly byte[]? Logo = CargarLogo();

    static ConsentimientoPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private static byte[]? CargarLogo()
    {
        var ruta = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-peredent.png");
        return File.Exists(ruta) ? File.ReadAllBytes(ruta) : null;
    }

    public byte[] Generar(ConsentimientoDto consentimiento)
    {
        return Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.Letter);
                page.MarginHorizontal(60);
                page.MarginVertical(36);
                page.DefaultTextStyle(t => t.FontSize(TamanoTexto).FontColor(ColorTexto).LineHeight(1.25f));

                page.Header().Element(Encabezado);
                page.Content().PaddingTop(10).Element(c => Cuerpo(c, consentimiento));
                page.Footer().Element(Pie);
            });
        }).GeneratePdf();
    }

    private static void Encabezado(IContainer container)
    {
        container.AlignRight().Height(92).Element(c =>
        {
            if (Logo is not null)
            {
                c.Image(Logo).FitHeight();
            }
        });
    }

    private static void Cuerpo(IContainer container, ConsentimientoDto c)
    {
        container.Column(col =>
        {
            col.Spacing(7);

            col.Item().PaddingBottom(6)
                .Text("CONSENTIMIENTO INFORMADO PARA LA EXODONCIA QUIRÚRGICA DE TERCEROS MOLARES INCLUIDOS")
                .FontSize(13).Bold();

            col.Item().Text(t =>
            {
                t.Span("Para satisfacción de los DERECHOS DEL PACIENTE, como instrumento favorecedor del correcto uso de los Procedimientos Diagnósticos y Terapéuticos, y en cumplimiento de la Ley General de Sanidad en relación con la Ley Orgánica 1/1982.");
            });

            col.Item().Text(t =>
            {
                t.Span("Yo, D/Doña. ");
                Campo(t, c.NombrePaciente, 60);
                t.Span(" como paciente o (D/Doña como su representante), ");
                Campo(t, c.NombreRepresentante, 60);
                t.Span(" en pleno uso de mis facultades, libre y voluntariamente, DECLARO que he sido debidamente INFORMADO/A, por el Dr. ");
                Campo(t, c.NombreDoctor, 50);
                t.Span(", y en consecuencia, AUTORIZO a ");
                Campo(t, c.NombreDoctor, 40);
                t.Span(" para que me sea realizado el procedimiento diagnóstico/terapéutico denominado ");
                Campo(t, c.Procedimiento, 60);
                t.Span(" o cualquier otro procedimiento que estime necesario para completar el tratamiento previsto.");
            });

            col.Item().Text("Me doy por enterado/a de los siguientes puntos relativos a dicho procedimiento:");

            col.Item().Text(t =>
            {
                t.Span("La cirugía oral se hace necesaria para el tratamiento de muy diversas problemas y patologías de la cavidad oral. Entre dichas patologías se encuentran los terceros molares o muelas del juicio incluidas superiores e inferiores así como quistes u otras entidades relacionadas. La causa más frecuente de inclusión de estos dientes es la falta de espacio en la arcada y en casos más excepcionales la presencia de patologías asociadas. La intervención puede realizarse con anestesia general o local con el riesgo inherente asociado a la misma, que serán informados por su anestesista, y los fármacos utilizados pueden producir determinadas alteraciones del nivel de conciencia por lo que no podré realizar determinadas actividades inmediatamente, tales como conducir un vehículo.");
            });

            col.Item().Text(t =>
            {
                t.Span("Todos estos procedimientos tienen el fin de conseguir un indudable beneficio, sin embargo, no están exentos de complicaciones, algunas de ellas inevitables en casos excepcionales, siendo las estadísticamente más frecuentes:");
            });

            col.Item().Column(lista =>
            {
                lista.Spacing(1);
                foreach (var complicacion in Complicaciones)
                {
                    lista.Item().Text($"- {complicacion}");
                }
            });

            col.Item().PaddingTop(4).Text(t =>
            {
                t.Span("Riesgos específicos en mi caso y otras complicaciones de mínima relevancia estadística ");
                Campo(t, c.RiesgosEspecificos, 120);
            });

            col.Item().Text(t =>
            {
                t.Span("Recibida la anterior información, considero que he comprendido la naturaleza y propósitos del procedimiento ");
                Campo(t, c.Procedimiento, 60);
                t.Span(". Además en entrevista personal con el Dr ");
                Campo(t, c.NombreDoctor, 50);
                t.Span(" he sido informado/a, en términos que he comprendido, del alcance de dicho tratamiento. En la entrevista he tenido la oportunidad de proponer y resolver mis posibles dudas, y de obtener cuanta información complementaria he creído necesaria. Por ello, me considero en condiciones de sopesar debidamente tanto sus posibles riesgos como la utilidad y beneficios que de él puedo obtener.");
            });

            col.Item().Text(t =>
            {
                t.Span("Estoy satisfecho/a con la información que se me ha proporcionado y, por ello, ");
                t.Span("DOY MI CONSENTIMIENTO").Bold();
                t.Span(" para que se me practique ");
                Campo(t, c.Procedimiento, 60);
                t.Span(".");
            });

            col.Item().Text(t =>
            {
                t.Span("Este consentimiento puede ser revocado por mí sin necesidad de justificación alguna, en cualquier momento antes de realizar el procedimiento.");
            });

            col.Item().Text(t =>
            {
                t.Span("Observaciones ");
                Campo(t, c.Observaciones, 140);
            });

            col.Item().Text(t =>
            {
                t.Span("Y, para que así conste, firmo el presente original ");
                t.Span("después de leído").Bold();
                t.Span(", por duplicado, cuya copia se me proporciona.");
            });

            col.Item().PaddingTop(6).Text(t =>
            {
                var fecha = c.FechaConsentimiento;
                t.Span("En ");
                Campo(t, c.Lugar, 25);
                t.Span(" a ");
                Campo(t, fecha.Day.ToString(Cultura), 0);
                t.Span(" de ");
                Campo(t, Meses[fecha.Month - 1], 0);
                t.Span(" de ");
                Campo(t, fecha.Year.ToString(Cultura), 0);
            });

            // Firmas: siempre en blanco (SCRUM-262). Se mantiene junto para que
            // el bloque no quede partido entre dos páginas.
            col.Item().PaddingTop(60).ShowEntire().Column(firmas =>
            {
                firmas.Item().Row(row =>
                {
                    row.RelativeItem().Element(f => BloqueFirma(f,
                        "Firma del paciente",
                        "(o su representante legal en caso de incapacidad).",
                        $"DPI {c.DocumentoPaciente}"));

                    row.ConstantItem(50);

                    row.RelativeItem().Element(f => BloqueFirma(f,
                        "Firma del médico",
                        $"Dr. {c.NombreDoctor}",
                        string.IsNullOrWhiteSpace(c.ColegiadoDoctor)
                            ? "Nº de colegiado"
                            : $"Nº de colegiado {c.ColegiadoDoctor}"));
                });

                firmas.Item().PaddingTop(55).AlignCenter().Width(260).Element(f => BloqueFirma(f,
                    "En caso de negativa por parte del paciente a firmar el consentimiento",
                    "Firma del testigo (DPI)"));
            });
        });
    }

    private static void BloqueFirma(IContainer container, params string[] lineas)
    {
        container.Column(c =>
        {
            c.Item().LineHorizontal(0.8f).LineColor(ColorLineaFirma);
            foreach (var linea in lineas)
            {
                c.Item().PaddingTop(2).Text(linea).FontSize(8);
            }
        });
    }

    private static void Pie(IContainer container)
    {
        container.AlignCenter().Column(c =>
        {
            c.Item().AlignCenter().Text("PEREDENT").FontSize(8).Bold().FontColor(ColorTenue);
            c.Item().AlignCenter().Text(t =>
            {
                t.DefaultTextStyle(s => s.FontSize(7.5f).FontColor(ColorTenue));
                t.Span("Odontología General · Ortodoncia · Cirugía Maxilofacial · Página ");
                t.CurrentPageNumber();
                t.Span(" de ");
                t.TotalPages();
            });
        });
    }

    // Valor llenado en negrita; si un campo opcional viene vacío se deja la
    // línea punteada del formato original para completarlo a mano.
    private static void Campo(TextDescriptor t, string? valor, int puntos)
    {
        if (string.IsNullOrWhiteSpace(valor))
        {
            t.Span(new string('.', Math.Max(puntos, 8))).FontColor(ColorTenue);
            return;
        }

        t.Span(valor.Trim()).Bold();
    }
}
