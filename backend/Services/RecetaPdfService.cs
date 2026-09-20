using System.Globalization;
using Peredent.Api.DTOs.Response;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Peredent.Api.Services;

// SCRUM-95: exportación de la receta médica en PDF. Mismo motor (QuestPDF) y
// mismo logo que PresupuestoPdfService, con un layout que sigue el diseño ya
// afinado en el frontend: encabezado con logo + datos del odontólogo,
// paciente en negrita sin recuadro, medicamentos como texto separado por una
// línea delgada (sin cajas de color) y una sola línea de "Firma y Sello".
public class RecetaPdfService : IRecetaPdfService
{
    private static readonly CultureInfo Cultura = CultureInfo.InvariantCulture;

    private const string ColorTeal = "#0F766E";
    private const string ColorLinea = "#E5E7EB";
    private const string ColorTextoTenue = "#6B7280";
    private const string ColorTexto = "#1F2937";
    private const string ColorEtiqueta = "#374151";

    private static readonly byte[]? Logo = CargarLogo();

    static RecetaPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private static byte[]? CargarLogo()
    {
        var ruta = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-peredent.png");
        return File.Exists(ruta) ? File.ReadAllBytes(ruta) : null;
    }

    public byte[] Generar(RecetaDto receta)
    {
        return Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.Letter);
                page.Margin(40);
                page.DefaultTextStyle(t => t.FontSize(10).FontColor(ColorTexto));

                page.Header().Element(c => Encabezado(c, receta));
                page.Content().PaddingVertical(18).Element(c => Cuerpo(c, receta));
                page.Footer().Element(Pie);
            });
        }).GeneratePdf();
    }

    private static void Encabezado(IContainer container, RecetaDto r)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                if (Logo is not null)
                {
                    row.ConstantItem(85).AlignTop().Image(Logo).FitWidth();
                }

                row.RelativeItem().PaddingLeft(14).Column(c =>
                {
                    c.Item().Text($"Dr(a). {r.Odontologo.Nombres} {r.Odontologo.Apellidos}".Trim())
                        .FontSize(14).Bold().FontColor(ColorTeal);
                    c.Item().PaddingTop(2).Text($"Colegiado No. {r.Odontologo.Colegiado}").FontSize(9.5f);
                    c.Item().Text(r.Odontologo.Direccion).FontSize(9.5f);
                    c.Item().Text($"Tel. {r.Odontologo.Telefono} · {r.Odontologo.Correo}").FontSize(9.5f);
                });

                row.ConstantItem(120).Column(c =>
                {
                    c.Item().AlignRight().Text("FECHA DE EMISIÓN").FontSize(8).Bold().FontColor(ColorEtiqueta).LetterSpacing(0.03f);
                    c.Item().AlignRight().PaddingTop(2).Text(FormatearFecha(r.FechaEmision)).FontSize(11).Bold();
                    c.Item().AlignRight().Text(FormatearHora(r.FechaEmision)).FontSize(9).FontColor(ColorTextoTenue);
                });
            });

            col.Item().PaddingTop(10).LineHorizontal(2).LineColor(ColorTeal);
        });
    }

    private static void Cuerpo(IContainer container, RecetaDto r)
    {
        container.Column(col =>
        {
            col.Spacing(16);

            col.Item().Text(t =>
            {
                t.DefaultTextStyle(ts => ts.FontSize(11.5f));
                t.Span("Paciente: ").Bold();
                t.Span(r.NombrePaciente).Bold();
            });

            col.Item().Column(meds =>
            {
                meds.Spacing(10);
                foreach (var m in r.Medicamentos)
                {
                    meds.Item().BorderBottom(1).BorderColor(ColorLinea).PaddingBottom(8).Column(c =>
                    {
                        var nombreCompleto = string.IsNullOrWhiteSpace(m.Presentacion)
                            ? m.Nombre
                            : $"{m.Nombre} {m.Presentacion}";
                        c.Item().Text(nombreCompleto).FontSize(11).Bold();

                        if (!string.IsNullOrWhiteSpace(m.Indicaciones))
                        {
                            c.Item().PaddingTop(2).Text(m.Indicaciones).FontSize(9.5f);
                        }
                    });
                }
            });

            if (!string.IsNullOrWhiteSpace(r.NotasAdicionales))
            {
                col.Item().BorderTop(1).BorderColor(ColorLinea).PaddingTop(10).Column(c =>
                {
                    c.Item().Text("OTRAS INDICACIONES").FontSize(8).Bold().FontColor(ColorEtiqueta).LetterSpacing(0.03f);
                    c.Item().PaddingTop(3).Text(r.NotasAdicionales).FontSize(9.5f);
                });
            }

            col.Item().PaddingTop(30).AlignCenter().Column(c =>
            {
                c.Item().Width(260).LineHorizontal(1).LineColor("#9CA3AF");
                c.Item().AlignCenter().PaddingTop(4)
                    .Text($"Firma y Sello — Dr(a). {r.Odontologo.Nombres} {r.Odontologo.Apellidos}".Trim())
                    .FontSize(9.5f).FontColor(ColorEtiqueta);
            });
        });
    }

    private static void Pie(IContainer container)
    {
        container.AlignCenter().Text(text =>
        {
            text.DefaultTextStyle(t => t.FontSize(8).FontColor("#9CA3AF"));
            text.Span("Peredent · Receta generada el ");
            text.Span(FormatearFecha(DateTime.UtcNow.AddHours(-6)));
        });
    }

    private static string FormatearFecha(DateTime fecha) => fecha.ToString("dd/MM/yyyy", Cultura);

    private static string FormatearHora(DateTime fecha) => fecha.ToString("hh:mm tt", Cultura);
}
