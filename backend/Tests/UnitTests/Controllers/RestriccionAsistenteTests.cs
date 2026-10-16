using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Peredent.Api.Controllers;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Controllers;

// SCRUM-288 / SCRUM-290: las secciones "Tratamiento pendiente", "Historial de
// tratamientos", "Historial de planes", "Presupuesto", "Saldo y abonos" y
// "Radiografías/Panorámicas" son solo del odontólogo. Aunque la asistente
// llame a la API directo, los endpoints la rechazan (403) por el rol.
public class RestriccionAsistenteTests
{
    private const string RolOdontologo = "Odontologo";

    // El rol exigido por el método o, si no tiene, por el controller.
    private static string? RolesExigidos(Type controller, string metodo)
    {
        var info = controller.GetMethod(metodo, BindingFlags.Public | BindingFlags.Instance)
            ?? throw new InvalidOperationException($"{controller.Name}.{metodo} no existe.");

        var delMetodo = info.GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Roles).FirstOrDefault(r => r is not null);
        var delController = controller.GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Roles).FirstOrDefault(r => r is not null);
        return delMetodo ?? delController;
    }

    [Theory]
    [InlineData(nameof(PlanTratamientoController.GetHistorial))]
    [InlineData(nameof(PlanTratamientoController.GetHistorialTratamientos))]
    [InlineData(nameof(PlanTratamientoController.GetPresupuesto))]
    [InlineData(nameof(PlanTratamientoController.GetPresupuestoPdf))]
    [InlineData(nameof(PlanTratamientoController.GetPendientes))]
    [InlineData(nameof(PlanTratamientoController.MarcarCompletado))]
    public void PlanTratamiento_SeccionesRestringidas_SoloOdontologo(string metodo)
    {
        Assert.Equal(RolOdontologo, RolesExigidos(typeof(PlanTratamientoController), metodo));
    }

    // El plan de tratamiento sigue visible para la asistente.
    [Theory]
    [InlineData(nameof(PlanTratamientoController.GetByPaciente))]
    [InlineData(nameof(PlanTratamientoController.Guardar))]
    [InlineData(nameof(PlanTratamientoController.Finalizar))]
    public void PlanTratamiento_PlanEnSi_SigueAbiertoALaAsistente(string metodo)
    {
        Assert.Null(RolesExigidos(typeof(PlanTratamientoController), metodo));
    }

    [Theory]
    [InlineData(typeof(AbonosController))]
    [InlineData(typeof(PanoramicasController))]
    public void SaldoYAbonos_Y_Panoramicas_SoloOdontologo(Type controller)
    {
        var authorize = controller.GetCustomAttribute<AuthorizeAttribute>();

        Assert.NotNull(authorize);
        Assert.Equal(RolOdontologo, authorize!.Roles);
    }
}
