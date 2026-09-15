using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Controllers;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Controllers;

public class AuthControllerTests
{
    private const string ClaveValida = "claveSegura123";

    // Fake mínimo: estos tests verifican la lógica de AuthController (credenciales,
    // estado del usuario), no la generación real del JWT -- eso ya lo cubre
    // JwtTokenServiceTests.
    private class JwtTokenServiceFake : IJwtTokenService
    {
        public string GenerarToken(Usuario usuario) => "token-de-prueba";
    }

    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static AuthController CrearController(ApplicationDbContext db) =>
        new(db, new JwtTokenServiceFake(), new PasswordHasher());

    private static async Task<Usuario> SembrarUsuarioAsync(
        ApplicationDbContext db, bool estado = true, string nombreUsuario = "dra.solis")
    {
        db.Roles.Add(new Rol { IdRol = 1, NombreRol = "Odontologo" });

        var hasher = new PasswordHasher();
        var salt = hasher.GenerarSalt();
        var usuario = new Usuario
        {
            NombreUsuario = nombreUsuario,
            Salt = salt,
            ContrasenaHash = hasher.HashClave(ClaveValida, salt),
            IdRol = 1,
            Estado = estado,
        };
        db.Usuarios.Add(usuario);
        await db.SaveChangesAsync();
        return usuario;
    }

    [Fact]
    public async Task Login_CredencialesValidas_Devuelve200ConToken()
    {
        using var db = CrearContexto();
        await SembrarUsuarioAsync(db);
        var controller = CrearController(db);

        var resultado = await controller.Login(new LoginDto { Usuario = "dra.solis", Clave = ClaveValida });

        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        var dto = Assert.IsType<AuthResponseDto>(ok.Value);
        Assert.Equal("token-de-prueba", dto.Token);
    }

    [Fact]
    public async Task Login_ClaveIncorrecta_Devuelve401()
    {
        using var db = CrearContexto();
        await SembrarUsuarioAsync(db);
        var controller = CrearController(db);

        var resultado = await controller.Login(new LoginDto { Usuario = "dra.solis", Clave = "claveIncorrecta" });

        Assert.IsType<UnauthorizedObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Login_UsuarioInexistente_Devuelve401()
    {
        using var db = CrearContexto();
        var controller = CrearController(db);

        var resultado = await controller.Login(new LoginDto { Usuario = "no.existe", Clave = ClaveValida });

        Assert.IsType<UnauthorizedObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Login_UsuarioDeshabilitado_Devuelve401()
    {
        using var db = CrearContexto();
        await SembrarUsuarioAsync(db, estado: false);
        var controller = CrearController(db);

        var resultado = await controller.Login(new LoginDto { Usuario = "dra.solis", Clave = ClaveValida });

        Assert.IsType<UnauthorizedObjectResult>(resultado.Result);
    }
}
