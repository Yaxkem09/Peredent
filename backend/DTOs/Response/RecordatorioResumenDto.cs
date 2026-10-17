namespace Peredent.Api.DTOs.Response;

public class RecordatorioResumenDto
{
    public DateOnly FechaObjetivo { get; set; }

    public bool DryRun { get; set; }

    // true = ya había otra ejecución en curso; esta no envió nada (el endpoint responde 409).
    public bool EjecucionEnCurso { get; set; }

    public int TotalEncontradas { get; set; }

    public int Enviadas { get; set; }

    public int Fallidas { get; set; }

    public int Omitidas { get; set; }

    // Solo en dryRun: las que se enviarían en una ejecución real.
    public int PorEnviar { get; set; }

    public List<RecordatorioDetalleDto> Detalle { get; set; } = new();
}

public class RecordatorioDetalleDto
{
    public int IdCita { get; set; }

    // Nombre tal como va en la plantilla ({{1}}): primer nombre + primer apellido.
    public string NombrePaciente { get; set; } = string.Empty;

    // Solo los últimos 4 dígitos; el teléfono completo nunca sale en la respuesta.
    public string TelefonoEnmascarado { get; set; } = string.Empty;

    // Variables {{2}} y {{3}} de la plantilla.
    public string Fecha { get; set; } = string.Empty;

    public string Hora { get; set; } = string.Empty;

    // Ver RecordatorioResultados.
    public string Resultado { get; set; } = string.Empty;

    // Motivo de la omisión o error del envío; null si se envió (o se enviaría).
    public string? Motivo { get; set; }
}

public static class RecordatorioResultados
{
    public const string Enviado = "Enviado";
    public const string Fallido = "Fallido";
    public const string Omitido = "Omitido";
    public const string PorEnviar = "Por enviar";
}
