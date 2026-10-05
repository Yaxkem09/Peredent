using System.Security.Claims;
using Microsoft.AspNetCore.Http;
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

// SCRUM-237 a 239: configuración de la propia cuenta (datos, correo y contraseña).
public class CuentaControllerTests
{
    private const string ClaveActual = "ClaveActual123";
    private const string ClaveNueva = "ClaveNueva456";
    private const int IdUsuarioToken = 5;

    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static CuentaController CrearController(ApplicationDbContext db, int? idUsuario = IdUsuarioToken)
    {
        var controller = new CuentaController(db, new PasswordHasher());
        var claims = idUsuario is null
            ? Array.Empty<Claim>()
            : new[] { new Claim("idUsuario", idUsuario.Value.ToString()) };

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test")) },
        };

        return controller;
    }

    private static async Task<Usuario> CrearUsuarioAsync(
        ApplicationDbContext db,
        int idUsuario = IdUsuarioToken,
        string nombreUsuario = "dra.solis",
        string? correo = "dra.solis@peredent.local")
    {
        if (!await db.Roles.AnyAsync(r => r.IdRol == 1))
        {
            db.Roles.Add(new Rol { IdRol = 1, NombreRol = "Odontologo" });
        }

        var usuario = new Usuario
        {
            IdUsuario = idUsuario,
            NombreUsuario = nombreUsuario,
            CorreoUsuario = correo,
            Salt = string.Empty,
            ContrasenaHash = new PasswordHasher().Hashear(ClaveActual),
            IdRol = 1,
            Estado = true,
        };

        db.Usuarios.Add(usuario);
        await db.SaveChangesAsync();
        return usuario;
    }

    private static CuentaDto ExtraerCuenta(ActionResult<CuentaDto> resultado)
    {
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsType<CuentaDto>(ok.Value);
    }

    // Los mensajes viajan como { message = "..." }.
    private static string MensajeDe(ActionResult? resultado)
    {
        var malo = Assert.IsType<BadRequestObjectResult>(resultado);
        return (string)malo.Value!.GetType().GetProperty("message")!.GetValue(malo.Value)!;
    }

    [Fact]
    public async Task Get_DevuelveLosDatosDeLaCuenta()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);

        var cuenta = ExtraerCuenta(await CrearController(db).Get());

        Assert.Equal(IdUsuarioToken, cuenta.IdUsuario);
        Assert.Equal("dra.solis", cuenta.NombreUsuario);
        Assert.Equal("Odontologo", cuenta.Rol);
        Assert.Equal("dra.solis@peredent.local", cuenta.Correo);
        Assert.False(cuenta.EsAdmin);
    }

    [Fact]
    public async Task Get_SinClaimIdUsuario_Devuelve401()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);

        var resultado = await CrearController(db, idUsuario: null).Get();

        Assert.IsType<UnauthorizedResult>(resultado.Result);
    }

    [Fact]
    public async Task Get_UsuarioDelTokenInexistente_Devuelve401()
    {
        using var db = CrearContexto();

        var resultado = await CrearController(db, idUsuario: 99).Get();

        Assert.IsType<UnauthorizedResult>(resultado.Result);
    }

    [Fact]
    public async Task CambiarContrasena_Valido_GuardaBcryptYLaNuevaEntra()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);
        var controller = CrearController(db);

        var resultado = await controller.CambiarContrasena(new CambiarContrasenaDto
        {
            ContrasenaActual = ClaveActual,
            NuevaContrasena = ClaveNueva,
            Confirmacion = ClaveNueva,
        });

        var ok = Assert.IsType<OkObjectResult>(resultado);
        var hasher = new PasswordHasher();
        var guardado = await db.Usuarios.SingleAsync(u => u.IdUsuario == usuario.IdUsuario);
        Assert.StartsWith("$2", guardado.ContrasenaHash);
        Assert.Equal(60, guardado.ContrasenaHash.Length);
        Assert.Equal(string.Empty, guardado.Salt);
        Assert.True(hasher.Verificar(ClaveNueva, guardado.ContrasenaHash, guardado.Salt));
        Assert.False(hasher.Verificar(ClaveActual, guardado.ContrasenaHash, guardado.Salt));
    }

    [Fact]
    public async Task CambiarContrasena_ActualIncorrecta_Devuelve400YNoCambia()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);

        var resultado = await CrearController(db).CambiarContrasena(new CambiarContrasenaDto
        {
            ContrasenaActual = "NoEsLaCorrecta1",
            NuevaContrasena = ClaveNueva,
            Confirmacion = ClaveNueva,
        });

        Assert.Contains("contraseña actual", MensajeDe(resultado));
        var guardado = await db.Usuarios.SingleAsync(u => u.IdUsuario == usuario.IdUsuario);
        Assert.Equal(usuario.ContrasenaHash, guardado.ContrasenaHash);
    }

    [Fact]
    public async Task CambiarContrasena_ConfirmacionDistinta_Devuelve400()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);

        var resultado = await CrearController(db).CambiarContrasena(new CambiarContrasenaDto
        {
            ContrasenaActual = ClaveActual,
            NuevaContrasena = ClaveNueva,
            Confirmacion = "OtraCosa456",
        });

        Assert.Contains("no coinciden", MensajeDe(resultado));
    }

    [Theory]
    [InlineData("Corta1")]           // menos de 8
    [InlineData("sInmayuscula1")]    // en realidad tiene mayúscula: caso válido de control
    [InlineData("SINMINUSCULA1")]    // sin minúscula
    [InlineData("SinNumeros")]       // sin número
    public async Task CambiarContrasena_Politica_DevuelveElResultadoEsperado(string clave)
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);

        var resultado = await CrearController(db).CambiarContrasena(new CambiarContrasenaDto
        {
            ContrasenaActual = ClaveActual,
            NuevaContrasena = clave,
            Confirmacion = clave,
        });

        var guardado = await db.Usuarios.SingleAsync(u => u.IdUsuario == usuario.IdUsuario);

        if (clave == "sInmayuscula1")
        {
            // Cumple la política (tiene mayúscula, minúscula y número): el cambio pasa.
            Assert.IsType<OkObjectResult>(resultado);
            Assert.True(new PasswordHasher().Verificar(clave, guardado.ContrasenaHash, guardado.Salt));
        }
        else
        {
            Assert.IsType<BadRequestObjectResult>(resultado);
            Assert.Equal(usuario.ContrasenaHash, guardado.ContrasenaHash);
        }
    }

    [Fact]
    public async Task CambiarContrasena_IgualALaActual_Devuelve400()
    {
        using var db = CrearContexto();
        var usuario = await CrearUsuarioAsync(db);

        var resultado = await CrearController(db).CambiarContrasena(new CambiarContrasenaDto
        {
            ContrasenaActual = ClaveActual,
            NuevaContrasena = ClaveActual,
            Confirmacion = ClaveActual,
        });

        Assert.Contains("distinta de la actual", MensajeDe(resultado));
        var guardado = await db.Usuarios.SingleAsync(u => u.IdUsuario == usuario.IdUsuario);
        Assert.Equal(usuario.ContrasenaHash, guardado.ContrasenaHash);
    }

    [Fact]
    public async Task ActualizarCorreo_Valido_LoGuardaEnMinusculas()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);
        var controller = CrearController(db);

        var resultado = await controller.ActualizarCorreo(new ActualizarCorreoDto
        {
            Correo = "  Nueva.Direccion@Peredent.COM ",
            ContrasenaActual = ClaveActual,
        });

        var cuenta = ExtraerCuenta(resultado);
        Assert.Equal("nueva.direccion@peredent.com", cuenta.Correo);
        Assert.Equal("nueva.direccion@peredent.com", (await db.Usuarios.SingleAsync()).CorreoUsuario);
    }

    [Fact]
    public async Task ActualizarCorreo_Vacio_LoDejaEnNulo()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);

        var resultado = await CrearController(db).ActualizarCorreo(new ActualizarCorreoDto
        {
            Correo = "   ",
            ContrasenaActual = ClaveActual,
        });

        Assert.Null(ExtraerCuenta(resultado).Correo);
        Assert.Null((await db.Usuarios.SingleAsync()).CorreoUsuario);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("NoEsLaCorrecta1")]
    public async Task ActualizarCorreo_SinContrasenaActualValida_Devuelve400(string? contrasena)
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);

        var resultado = await CrearController(db).ActualizarCorreo(new ActualizarCorreoDto
        {
            Correo = "otra@peredent.com",
            ContrasenaActual = contrasena,
        });

        Assert.Contains("contraseña actual", MensajeDe(resultado.Result));
        Assert.Equal("dra.solis@peredent.local", (await db.Usuarios.SingleAsync()).CorreoUsuario);
    }

    [Theory]
    [InlineData("sin-arroba.com")]
    [InlineData("falta@dominio")]
    [InlineData("con espacio@correo.com")]
    public async Task ActualizarCorreo_FormatoInvalido_Devuelve400(string correo)
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);

        var resultado = await CrearController(db).ActualizarCorreo(new ActualizarCorreoDto
        {
            Correo = correo,
            ContrasenaActual = ClaveActual,
        });

        Assert.Contains("correo electrónico válido", MensajeDe(resultado.Result));
    }

    [Fact]
    public async Task ActualizarCorreo_UsadoPorOtroUsuario_Devuelve400()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);
        await CrearUsuarioAsync(db, idUsuario: 6, nombreUsuario: "dr.perez", correo: "ocupado@peredent.com");

        var resultado = await CrearController(db).ActualizarCorreo(new ActualizarCorreoDto
        {
            Correo = "OCUPADO@peredent.com",
            ContrasenaActual = ClaveActual,
        });

        Assert.Contains("ya está en uso", MensajeDe(resultado.Result));
    }

    [Fact]
    public async Task ActualizarCorreo_ElMismoCorreoPropio_SePermite()
    {
        using var db = CrearContexto();
        await CrearUsuarioAsync(db);

        var resultado = await CrearController(db).ActualizarCorreo(new ActualizarCorreoDto
        {
            Correo = "dra.solis@peredent.local",
            ContrasenaActual = ClaveActual,
        });

        Assert.Equal("dra.solis@peredent.local", ExtraerCuenta(resultado).Correo);
    }
}
