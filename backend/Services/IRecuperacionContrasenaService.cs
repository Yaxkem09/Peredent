namespace Peredent.Api.Services;

// Motivo por el que un restablecimiento no se pudo completar. El controller lo usa
// para decidir el status; el mensaje ya viene listo para mostrar al usuario.
public enum RecuperacionError
{
    Ninguno,
    TokenInvalido,
    ContrasenasNoCoinciden,
    PoliticaContrasena,
}

// SCRUM-234: resultado de restablecer la contraseña (mismo patrón que
// PlanTratamientoService: Exitoso + Error + Mensaje).
public class RecuperacionResultado
{
    public bool Exitoso => Error == RecuperacionError.Ninguno;

    public RecuperacionError Error { get; init; }

    public string Mensaje { get; init; } = string.Empty;

    public static RecuperacionResultado Ok(string mensaje) =>
        new() { Error = RecuperacionError.Ninguno, Mensaje = mensaje };

    public static RecuperacionResultado Falla(RecuperacionError error, string mensaje) =>
        new() { Error = error, Mensaje = mensaje };
}

// SCRUM-231 a 236: recuperación de contraseña olvidada.
public interface IRecuperacionContrasenaService
{
    // SCRUM-231/232/233: pide el enlace. Devuelve SIEMPRE el mismo mensaje genérico,
    // exista o no la cuenta (y aunque el correo no se pueda enviar).
    Task<string> SolicitarAsync(string identificador);

    // SCRUM-234: true si el token existe, no se usó y no expiró.
    Task<bool> TokenEsValidoAsync(string token);

    // SCRUM-234/235/236: cambia la contraseña y deja el enlace sin uso.
    Task<RecuperacionResultado> RestablecerAsync(string token, string nuevaContrasena, string confirmacion);
}
