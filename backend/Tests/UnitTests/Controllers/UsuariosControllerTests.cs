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

    private static CreateUsuarioDto NuevoUsuarioDto(string nombreUsuario, int idRol) => new()
    {
        NombreUsuario = nombreUsuario,
        Clave = "claveSegura123",
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
        Assert.Equal("Odontologo", dto.Rol);
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
}
