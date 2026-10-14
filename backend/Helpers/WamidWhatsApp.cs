namespace Peredent.Api.Helpers;

public static class WamidWhatsApp
{
    private const string Prefijo = "wamid.";
    private const int CaracteresVisibles = 6;

    // Para logs: el "wamid" que genera Meta lleva el teléfono del destinatario
    // codificado en base64 al inicio (p. ej. "wamid.HBgLNTAy..." => "502..."),
    // así que nunca se registra completo. Se dejan solo los últimos caracteres
    // (parte aleatoria del id), suficientes para cruzarlo con la base de datos:
    // "wamid.HBgLNTAyNDUy...RUEA" => "wamid.…ERUEA". En la base se guarda completo.
    public static string Enmascarar(string? wamid)
    {
        if (string.IsNullOrEmpty(wamid))
        {
            return "(sin id)";
        }

        var cuerpo = wamid.StartsWith(Prefijo, StringComparison.Ordinal) ? wamid[Prefijo.Length..] : wamid;

        return cuerpo.Length <= CaracteresVisibles
            ? Prefijo + "…"
            : Prefijo + "…" + cuerpo[^CaracteresVisibles..];
    }
}
