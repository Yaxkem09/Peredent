namespace Peredent.Api.Helpers;

public static class TelefonoWhatsApp
{
    private const string CodigoGuatemala = "502";
    private const int DigitosLocalesGuatemala = 8;

    // Convierte el teléfono guardado (texto libre: "5555-5555", "+502 4527 8707"...)
    // al formato que pide la WhatsApp Cloud API: solo dígitos con código de
    // país y sin "+" (ej. "50245278707"). 8 dígitos se asumen de Guatemala.
    // Devuelve null si no se puede normalizar. No modifica el dato guardado.
    public static string? Normalizar(string? telefono)
    {
        if (string.IsNullOrWhiteSpace(telefono))
        {
            return null;
        }

        var digitos = new string(telefono.Where(char.IsAsciiDigit).ToArray());

        if (digitos.Length == DigitosLocalesGuatemala)
        {
            return CodigoGuatemala + digitos;
        }

        if (digitos.Length == CodigoGuatemala.Length + DigitosLocalesGuatemala && digitos.StartsWith(CodigoGuatemala))
        {
            return digitos;
        }

        return null;
    }
}
