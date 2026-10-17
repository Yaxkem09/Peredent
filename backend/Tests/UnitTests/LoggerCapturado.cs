using Microsoft.Extensions.Logging;

namespace Peredent.Api.Tests.UnitTests;

// ILogger<T> que guarda el texto de cada entrada (todos los niveles, incluido
// Debug), para verificar qué NO debe aparecer en los logs.
internal sealed class LoggerCapturado<T> : ILogger<T>
{
    public List<string> Entradas { get; } = new();

    public string TodoElTexto => string.Join('\n', Entradas);

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        lock (Entradas)
        {
            Entradas.Add($"{logLevel}: {formatter(state, exception)} {exception}");
        }
    }
}

// wamid con la forma real que genera Meta: el teléfono del destinatario va
// codificado en base64 al inicio ("NTAyNTEyMzQ1Njc" = "50251234567", ficticio).
internal static class WamidsDePrueba
{
    public const string TelefonoBase64 = "NTAyNTEyMzQ1Njc";

    public const string Recordatorio = "wamid.HBgLNTAyNTEyMzQ1NjcVAgARGBI0QzRjE2QkEyRTk5NjAyRkEA";
    public const string Respuesta = "wamid.HBgLNTAyNTEyMzQ1NjcVAgASGBQzQTdGQjU5RUQ4MzIwRTQ0NEI3NgA";
    public const string Desconocido = "wamid.HBgLNTAyNTEyMzQ1NjcVAgARGBJBMjM0NUY2Nzg5MEFCQ0RFRjEA";
}
