using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Peredent.Api.Models;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Services;

public class JwtTokenServiceTests
{
    private static JwtTokenService CrearServicio()
    {
        var configuracion = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT_SECRET"] = "clave-de-prueba-para-tests-de-al-menos-32-bytes",
            })
            .Build();
        return new JwtTokenService(configuracion);
    }

    private static Usuario NuevoUsuario(bool esAdmin) => new()
    {
        NombreUsuario = "dra.solis",
        Salt = "salt",
        ContrasenaHash = "hash",
        IdRol = 1,
        Estado = true,
        EsAdmin = esAdmin,
        Rol = new Rol { IdRol = 1, NombreRol = "Odontologo" },
    };

    private static JwtSecurityToken Decodificar(string token) => new JwtSecurityTokenHandler().ReadJwtToken(token);

    [Fact]
    public void GenerarToken_UsuarioEsAdmin_EmiteClaimEsAdminTrue()
    {
        var token = Decodificar(CrearServicio().GenerarToken(NuevoUsuario(esAdmin: true)));

        Assert.Equal("true", token.Claims.Single(c => c.Type == "esAdmin").Value);
    }

    [Fact]
    public void GenerarToken_UsuarioNoEsAdmin_EmiteClaimEsAdminFalse()
    {
        var token = Decodificar(CrearServicio().GenerarToken(NuevoUsuario(esAdmin: false)));

        Assert.Equal("false", token.Claims.Single(c => c.Type == "esAdmin").Value);
    }

    [Fact]
    public void GenerarToken_EmiteClaimRoleConElNombreDelRolDelUsuario()
    {
        var token = Decodificar(CrearServicio().GenerarToken(NuevoUsuario(esAdmin: false)));

        Assert.Equal("Odontologo", token.Claims.Single(c => c.Type == ClaimTypes.Role).Value);
    }

    [Fact]
    public void GenerarToken_EmiteNameIdentifierConElNombreDeUsuario()
    {
        var token = Decodificar(CrearServicio().GenerarToken(NuevoUsuario(esAdmin: false)));

        Assert.Equal("dra.solis", token.Claims.Single(c => c.Type == ClaimTypes.NameIdentifier).Value);
    }
}
