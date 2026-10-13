namespace Peredent.Api.Services;

// SCRUM-230: todo lo que crea o verifica contraseñas pasa por acá. Desde este
// ticket el formato nuevo es bcrypt y se sigue verificando el formato legado
// SHA2_256(clave + salt) de los usuarios ya sembrados en la base.
public interface IPasswordHasher
{
    // Hash nuevo con bcrypt (60 caracteres: cabe en Contrasena_Hash VARCHAR(64)).
    string Hashear(string clave);

    // Verificación dual: el formato se detecta por el propio hash guardado, así que
    // el llamador no tiene que saber si el usuario es viejo o nuevo.
    bool Verificar(string clave, string hashGuardado, string? salt);

    // true cuando el hash guardado todavía no es bcrypt y conviene recalcularlo
    // (lo usa el login para migrar sin pedirle nada al usuario).
    bool NecesitaMigracion(string hashGuardado);
}
