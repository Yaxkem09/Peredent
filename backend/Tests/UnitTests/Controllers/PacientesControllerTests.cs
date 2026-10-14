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
    // Un número por campo: con separadores se guarda limpio y el segundo
    // número va en TelefonoSecundario.
    [Fact]
    public async Task Create_TelefonosConSeparadores_SeGuardanSoloLosDigitos()
    {
        using var db = CrearContexto();
        var request = NuevoPaciente(null);
        request.Telefono = "4224 6235";
        request.TelefonoSecundario = "3440-1287";

        var creado = ExtraerCreado(await new PacientesController(db).Create(request));

        Assert.Equal("42246235", creado.Telefono);
        Assert.Equal("34401287", creado.TelefonoSecundario);
        var guardado = await db.Pacientes.SingleAsync();
        Assert.Equal("42246235", guardado.Telefono);
        Assert.Equal("34401287", guardado.TelefonoSecundario);
    }

    [Fact]
    public async Task Create_SinTelefonoSecundario_LoGuardaNull()
    {
        using var db = CrearContexto();
        var request = NuevoPaciente(null);
        request.TelefonoSecundario = "  ";

        var creado = ExtraerCreado(await new PacientesController(db).Create(request));

        Assert.Null(creado.TelefonoSecundario);
    }

    // Lo que se venía capturando ("42246235\ 34401287") ya no entra.
    [Theory]
    [InlineData(@"42246235\ 34401287", null, null)]
    [InlineData("54110066 59620061", null, null)]
    [InlineData("1234567", null, null)]
    [InlineData("5512abcd", null, null)]
    [InlineData("", null, null)]
    [InlineData("55123344", "123", null)]
    [InlineData("55123344", null, "55123344 55667788")]
    public async Task Create_TelefonoInvalido_Devuelve400YNoGuarda(string telefono, string? secundario, string? encargado)
    {
        using var db = CrearContexto();
        var request = NuevoPaciente(null);
        request.Telefono = telefono;
        request.TelefonoSecundario = secundario;
        request.EncargadoTelefono = encargado;

        var resultado = await new PacientesController(db).Create(request);

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Empty(await db.Pacientes.ToListAsync());
    }

    [Fact]
    public async Task Update_TelefonoConDosNumeros_Devuelve400YNoCambia()
    {
        using var db = CrearContexto();
        var controller = new PacientesController(db);
        var creado = ExtraerCreado(await controller.Create(NuevoPaciente(null)));
        var request = NuevoPaciente(null);
        request.Telefono = @"30989350\ 47144679";

        var resultado = await controller.Update(creado.Id, request);

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Equal("55123344", (await db.Pacientes.SingleAsync()).Telefono);
    }
}
