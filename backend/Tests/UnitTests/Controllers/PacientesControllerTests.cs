using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Controllers;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Controllers;

public class PacientesControllerTests
{
    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static CreatePacienteDto NuevoPaciente(string? nit) => new()
    {
        Nombres = "María",
        Apellidos = "González",
        FechaNacimiento = new DateTime(1990, 1, 1),
        Telefono = "5512-3344",
        Nit = nit,
    };

    private static PacienteDto ExtraerCreado(ActionResult<PacienteDto> resultado)
    {
        var creado = Assert.IsType<CreatedAtActionResult>(resultado.Result);
        return Assert.IsType<PacienteDto>(creado.Value);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("cf")]
    public async Task Create_SinNit_GuardaCF(string? nit)
    {
        using var db = CrearContexto();
        var controller = new PacientesController(db);

        var creado = ExtraerCreado(await controller.Create(NuevoPaciente(nit)));

        Assert.Equal("CF", creado.Nit);
        Assert.Equal("CF", db.Pacientes.Single().Nit);
    }

    [Fact]
    public async Task Create_ConNit_GuardaElValorIngresadoSinEspacios()
    {
        using var db = CrearContexto();
        var controller = new PacientesController(db);

        var creado = ExtraerCreado(await controller.Create(NuevoPaciente("  1234567-8 ")));

        Assert.Equal("1234567-8", creado.Nit);
    }

    [Fact]
    public async Task Create_NitDemasiadoLargo_Devuelve400YNoGuarda()
    {
        using var db = CrearContexto();
        var controller = new PacientesController(db);

        var resultado = await controller.Create(NuevoPaciente(new string('1', 16)));

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Empty(db.Pacientes);
    }

    [Fact]
    public async Task Update_NitVacio_VuelveACF()
    {
        using var db = CrearContexto();
        var controller = new PacientesController(db);
        var creado = ExtraerCreado(await controller.Create(NuevoPaciente("1234567-8")));

        var resultado = await controller.Update(creado.Id, NuevoPaciente(""));

        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        Assert.Equal("CF", Assert.IsType<PacienteDto>(ok.Value).Nit);
    }
}
