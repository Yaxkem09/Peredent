using System.Globalization;
using Peredent.Api.DTOs.Response;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Peredent.Api.Services;

// SCRUM-78: exportación del presupuesto en PDF. El documento contiene lo mismo
// que la vista del expediente —detalle de piezas, tratamientos y valores del
// plan reciente (SCRUM-79), totales, y la leyenda de conformidad (SCRUM-80)—
// más el logo de la clínica y espacio para la firma del paciente y del odontólogo.
public class PresupuestoPdfService : IPresupuestoPdfService
{
    private static readonly CultureInfo Cultura = CultureInfo.InvariantCulture;

    private const string ColorTeal = "#0F766E";
    private const string ColorLinea = "#E5E7EB";
    private const string ColorTextoTenue = "#6B7280";

    // Para las etiquetas (Paciente, Fecha de emisión, Plan del, las firmas): un
    // gris bastante más oscuro que ColorTextoTenue, para que resalten en vez de
    // verse apagadas al lado del valor que describen.
    private const string ColorEtiqueta = "#374151";

    // Logo de la clínica que se incrusta en el encabezado. Se lee una sola vez;
    // si el archivo no está desplegado, el encabezado queda solo con el texto.
    private static readonly byte[]? Logo = CargarLogo();

    static PresupuestoPdfService()
    {
        // QuestPDF exige declarar la licencia antes de generar cualquier PDF.
        // La clínica factura menos de USD 1M/año, así que aplica la Community
        // License (gratuita). Se fija aquí para que también valga en las pruebas
        // que instancian el servicio directamente.
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private static byte[]? CargarLogo()
    {
        var ruta = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-peredent.png");
        return File.Exists(ruta) ? File.ReadAllBytes(ruta) : null;
    }

    public byte[] Generar(PresupuestoDto presupuesto)
    {
        return Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(t => t.FontSize(10).FontColor("#1F2937"));

                page.Header().Element(Encabezado);
                page.Content().PaddingVertical(18).Element(c => Cuerpo(c, presupuesto));
                page.Footer().Element(Pie);
            });
        }).GeneratePdf();
    }

    private static void Encabezado(IContainer container)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text("PEREDENT").FontSize(16).Bold().FontColor(ColorTeal);
                    c.Item().Text("Presupuesto de tratamiento").FontSize(13).SemiBold();
                    c.Item().PaddingTop(2).Text("Documento para revisión y firma del paciente")
                        .FontSize(9).FontColor(ColorTextoTenue);
                });

                if (Logo is not null)
                {
                    row.ConstantItem(95).AlignTop().Image(Logo).FitWidth();
                }
            });

            col.Item().PaddingTop(8).LineHorizontal(1).LineColor(ColorLinea);
        });
    }

    private static void Cuerpo(IContainer container, PresupuestoDto p)
    {
        container.Column(col =>
        {
            col.Spacing(14);

            col.Item().Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text("PACIENTE").FontSize(8.5f).Bold().FontColor(ColorEtiqueta).LetterSpacing(0.03f);
                    c.Item().PaddingTop(1).Text(p.NombrePaciente).FontSize(11).SemiBold();
                });
                row.ConstantItem(140).Column(c =>
                {
                    c.Item().Text("FECHA DE EMISIÓN").FontSize(8.5f).Bold().FontColor(ColorEtiqueta).LetterSpacing(0.03f);
                    c.Item().PaddingTop(1).Text(FormatearFecha(p.FechaEmision)).FontSize(11).SemiBold();
                });
                row.ConstantItem(110).Column(c =>
                {
                    c.Item().Text("PLAN DEL").FontSize(8.5f).Bold().FontColor(ColorEtiqueta).LetterSpacing(0.03f);
                    c.Item().PaddingTop(1).Text(p.FechaPlan.HasValue ? FormatearFecha(p.FechaPlan.Value) : "—").FontSize(11).SemiBold();
                });
            });

            col.Item().Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(70);
                    columns.RelativeColumn();
                    columns.ConstantColumn(90);
                });

                table.Header(header =>
                {
                    header.Cell().Element(CeldaEncabezado).Text("Pieza");
                    header.Cell().Element(CeldaEncabezado).Text("Tratamiento");
                    header.Cell().Element(CeldaEncabezado).AlignRight().Text("Valor");
                });

                foreach (var linea in p.Detalle)
                {
                    table.Cell().Element(Celda).Text(linea.Pieza);
                    table.Cell().Element(Celda).Text(linea.Tratamiento);
                    table.Cell().Element(Celda).AlignRight().Text(FormatearMoneda(linea.Valor));
                }
            });

            col.Item().AlignRight().Column(c =>
            {
                c.Spacing(3);
                c.Item().Row(r =>
                {
                    r.ConstantItem(120).Text("Sub-total");
                    r.ConstantItem(90).AlignRight().Text(FormatearMoneda(p.Subtotal));
                });
                c.Item().Row(r =>
                {
                    r.ConstantItem(120).Text("Descuento");
                    r.ConstantItem(90).AlignRight().Text($"- {FormatearMoneda(p.Descuento)}");
                });
                c.Item().PaddingTop(4).BorderTop(1).BorderColor(ColorLinea).PaddingTop(4).Row(r =>
                {
                    r.ConstantItem(120).Text("Total").Bold();
                    r.ConstantItem(90).AlignRight().Text(FormatearMoneda(p.Total)).Bold();
                });
            });

            // SCRUM-80: leyenda de conformidad.
            col.Item().PaddingTop(10).Text(p.LeyendaConformidad)
                .FontSize(8.5f).Italic().FontColor(ColorTextoTenue);

            col.Item().PaddingTop(28).Text($"Fecha de emisión: {FormatearFecha(p.FechaEmision)}")
                .FontSize(8.5f).FontColor(ColorTextoTenue);

            col.Item().PaddingTop(40).Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().LineHorizontal(1).LineColor("#9CA3AF");
                    c.Item().PaddingTop(4).Text("Firma del paciente").FontSize(9.5f).Bold().FontColor(ColorEtiqueta);
                    c.Item().Text(p.NombrePaciente).FontSize(9).FontColor(ColorTextoTenue);
                });
                row.ConstantItem(40);
                row.RelativeItem().Column(c =>
                {
                    c.Item().LineHorizontal(1).LineColor("#9CA3AF");
                    c.Item().PaddingTop(4).Text("Firma y sello del odontólogo").FontSize(9.5f).Bold().FontColor(ColorEtiqueta);
                });
            });
        });
    }

    private static void Pie(IContainer container)
    {
        container.AlignCenter().Text(text =>
        {
            text.DefaultTextStyle(t => t.FontSize(8).FontColor("#9CA3AF"));
            text.Span("Peredent · Presupuesto generado el ");
            text.Span(FormatearFecha(DateTime.UtcNow.AddHours(-6)));
        });
    }

    private static IContainer CeldaEncabezado(IContainer container) =>
        container.Background(ColorTeal).Padding(6)
            .DefaultTextStyle(t => t.FontColor("#FFFFFF").SemiBold().FontSize(8.5f));

    private static IContainer Celda(IContainer container) =>
        container.BorderBottom(1).BorderColor(ColorLinea).Padding(6);

    private static string FormatearMoneda(decimal valor) => $"Q {valor.ToString("N2", Cultura)}";

    private static string FormatearFecha(DateTime fecha) => fecha.ToString("dd/MM/yyyy", Cultura);
}
