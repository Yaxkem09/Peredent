namespace Peredent.Api.Services;

public interface IPasswordHasher
{
    string GenerarSalt();

    string HashClave(string clave, string salt);
}
