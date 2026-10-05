using System.Security.Cryptography;
using System.Text;
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

    // hashLegado: true siembra el usuario como lo deja el script SQL (SHA2_256 con
    // salt); false lo siembra con el formato nuevo (bcrypt y Salt vacío).
    private static async Task<Usuario> SembrarUsuarioAsync(
        ApplicationDbContext db, bool estado = true, string nombreUsuario = "dra.solis", bool hashLegado = false)
    {
        db.Roles.Add(new Rol { IdRol = 1, NombreRol = "Odontologo" });

        var hasher = new PasswordHasher();
        var usuario = new Usuario
        {
            NombreUsuario = nombreUsuario,
            IdRol = 1,
            Estado = estado,
        };

        if (hashLegado)
        {
            usuario.Salt = "salt-viejo";
            usuario.ContrasenaHash = HashLegadoComoLaBase(ClaveValida, usuario.Salt);
        }
        else
        {
            usuario.Salt = string.Empty;
            usuario.ContrasenaHash = hasher.Hashear(ClaveValida);
        }

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

    // SCRUM-230: el usuario con hash legado entra igual y, al entrar, se le migra el
    // hash a bcrypt sin pedirle nada.
    [Fact]
    public async Task Login_ConHashLegado_EntraYMigraABcrypt()
    {
        using var db = CrearContexto();
        var usuario = await SembrarUsuarioAsync(db, hashLegado: true);
        var controller = CrearController(db);

        var resultado = await controller.Login(new LoginDto { Usuario = "dra.solis", Clave = ClaveValida });

        Assert.IsType<OkObjectResult>(resultado.Result);

        var guardado = await db.Usuarios.SingleAsync(u => u.IdUsuario == usuario.IdUsuario);
        Assert.StartsWith("$2", guardado.ContrasenaHash);
        Assert.Equal(60, guardado.ContrasenaHash.Length);
        Assert.Equal(string.Empty, guardado.Salt);
        Assert.True(new PasswordHasher().Verificar(ClaveValida, guardado.ContrasenaHash, guardado.Salt));
    }

    [Fact]
    public async Task Login_ConHashLegadoYClaveIncorrecta_Devuelve401YNoMigra()
    {
        using var db = CrearContexto();
        var usuario = await SembrarUsuarioAsync(db, hashLegado: true);
        var controller = CrearController(db);

        var resultado = await controller.Login(new LoginDto { Usuario = "dra.solis", Clave = "claveIncorrecta" });

        Assert.IsType<UnauthorizedObjectResult>(resultado.Result);
        var guardado = await db.Usuarios.SingleAsync(u => u.IdUsuario == usuario.IdUsuario);
        Assert.Equal(usuario.ContrasenaHash, guardado.ContrasenaHash);
    }

    // Ya migrado, un login correcto no vuelve a hashear.
    [Fact]
    public async Task Login_ConHashBcrypt_NoVuelveAMigrar()
    {
        using var db = CrearContexto();
        var usuario = await SembrarUsuarioAsync(db);
        var controller = CrearController(db);

        var resultado = await controller.Login(new LoginDto { Usuario = "dra.solis", Clave = ClaveValida });

        Assert.IsType<OkObjectResult>(resultado.Result);
        var guardado = await db.Usuarios.SingleAsync(u => u.IdUsuario == usuario.IdUsuario);
        Assert.Equal(usuario.ContrasenaHash, guardado.ContrasenaHash);
    }

    private static string HashLegadoComoLaBase(string clave, string salt)
    {
        var bytes = Encoding.UTF8.GetBytes(clave + salt);
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }
}
