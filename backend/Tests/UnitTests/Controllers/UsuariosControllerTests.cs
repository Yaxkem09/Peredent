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

public class UsuariosControllerTests
{
    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static UsuariosController CrearController(ApplicationDbContext db) =>
        new(db, new PasswordHasher());

    private static async Task SembrarRolAsync(ApplicationDbContext db, int idRol = 1, string nombreRol = "Odontologo")
    {
        db.Roles.Add(new Rol { IdRol = idRol, NombreRol = nombreRol });
        await db.SaveChangesAsync();
    }

    private static CreateUsuarioDto NuevoUsuarioDto(string nombreUsuario, int idRol, string? correo = null) => new()
    {
        NombreUsuario = nombreUsuario,
        Correo = correo ?? $"{nombreUsuario}@peredent.com",
        // SCRUM-235: el alta valida la política, así que la clave de prueba la cumple.
        Clave = "ClaveSegura123",
        IdRol = idRol,
    };

    [Fact]
    public async Task Create_IdRolInexistente_Devuelve400()
    {
        using var db = CrearContexto();
        await SembrarRolAsync(db, idRol: 1);
        var controller = CrearController(db);

        var resultado = await controller.Create(NuevoUsuarioDto("nuevo.usuario", idRol: 999));

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Create_DatosValidos_Devuelve200ConElUsuarioCreado()
    {
        using var db = CrearContexto();
        await SembrarRolAsync(db);
        var controller = CrearController(db);

        var resultado = await controller.Create(NuevoUsuarioDto("nuevo.usuario", idRol: 1));

        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        var dto = Assert.IsType<UsuarioDto>(ok.Value);
        Assert.Equal("nuevo.usuario", dto.NombreUsuario);
        Assert.Equal("nuevo.usuario@peredent.com", dto.Correo);
        Assert.Equal("Odontologo", dto.Rol);
    }

    // SCRUM-237: el correo es opcional; si viene, se valida el formato.
    [Theory]
    [InlineData("sin-arroba.com")]
    [InlineData("falta@dominio")]
    [InlineData("con espacio@correo.com")]
    public async Task Create_CorreoInvalido_Devuelve400YNoCrea(string correo)
    {
        using var db = CrearContexto();
        await SembrarRolAsync(db);
        var controller = CrearController(db);

        var resultado = await controller.Create(NuevoUsuarioDto("nuevo.usuario", idRol: 1, correo));

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Empty(db.Usuarios);
    }

    // Solo se inicia sesión con el correo: un usuario sin correo no podría entrar.
    [Fact]
    public async Task Create_SinCorreo_Devuelve400YNoCrea()
    {
        using var db = CrearContexto();
        await SembrarRolAsync(db);
        var controller = CrearController(db);

        var resultado = await controller.Create(NuevoUsuarioDto("nuevo.usuario", idRol: 1, correo: "   "));

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Empty(db.Usuarios);
    }

    // SCRUM-235: la contraseña del alta tiene que cumplir la política.
    [Theory]
    [InlineData("corta1")]
    [InlineData("sinmayuscula1")]
    [InlineData("SINMINUSCULA1")]
    [InlineData("SinNumeros")]
    public async Task Create_ClaveQueNoCumpleLaPolitica_Devuelve400YNoCrea(string clave)
    {
        using var db = CrearContexto();
        await SembrarRolAsync(db);
        var controller = CrearController(db);
        var request = NuevoUsuarioDto("nuevo.usuario", idRol: 1);
        request.Clave = clave;

        var resultado = await controller.Create(request);

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Empty(db.Usuarios);
    }

    [Fact]
    public async Task Create_CorreoDuplicadoSinImportarMayusculas_Devuelve400()
    {
        using var db = CrearContexto();
        await SembrarRolAsync(db);
        var controller = CrearController(db);
        await controller.Create(NuevoUsuarioDto("ana", idRol: 1, "ana@peredent.com"));

        var resultado = await controller.Create(NuevoUsuarioDto("ana.lopez", idRol: 1, "  ANA@Peredent.com "));

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Single(db.Usuarios);
    }

    [Fact]
    public async Task Create_NombreUsuarioDuplicado_Devuelve400()
    {
        using var db = CrearContexto();
        await SembrarRolAsync(db);
        var controller = CrearController(db);
        await controller.Create(NuevoUsuarioDto("repetido", idRol: 1));

        var resultado = await controller.Create(NuevoUsuarioDto("repetido", idRol: 1));

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
    }

    // SCRUM-268: el último acceso solo lo ve el administrador.
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task GetAll_UltimoAcceso_SoloSeMandaAlAdmin(bool esAdmin)
    {
        using var db = CrearContexto();
        await SembrarRolAsync(db);
        var acceso = new DateTime(2026, 10, 12, 9, 30, 0);
        db.Usuarios.Add(new Usuario { NombreUsuario = "doctor", IdRol = 1, Estado = true, UltimoAcceso = acceso });
        await db.SaveChangesAsync();

        var controller = CrearController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim("esAdmin", esAdmin ? "true" : "false") }, "Test")),
            },
        };

        var resultado = await controller.GetAll();

        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        var dto = Assert.Single(Assert.IsAssignableFrom<IEnumerable<UsuarioDto>>(ok.Value));
        Assert.Equal(esAdmin ? acceso : null, dto.UltimoAcceso);
    }
}
