namespace Peredent.Api.Helpers;

// SCRUM-65: fuente única de la fórmula del total y del saldo pendiente.
// El total NO se guarda en la base: se calcula contra las piezas del plan de
// tratamiento (SUM(valor) menos el descuento), y el saldo es ese total menos lo
// abonado. Vive aquí para que el plan de tratamiento, el presupuesto y los
// abonos usen exactamente la misma cuenta y no se duplique la fórmula.
public static class TotalesPlan
{
    // El total nunca queda negativo: un descuento mayor que el subtotal se trata
    // como total 0, igual que hacía el controller antes de extraer esto.
    public static decimal CalcularTotal(decimal subtotal, decimal descuento)
    {
        return Math.Max(subtotal - descuento, 0);
    }

    // El saldo sí puede quedar negativo (a favor del paciente) cuando se edita el
    // plan después de haber abonado; se devuelve tal cual para que la UI lo muestre.
    public static decimal CalcularSaldo(decimal total, decimal abonado)
    {
        return total - abonado;
    }
}
