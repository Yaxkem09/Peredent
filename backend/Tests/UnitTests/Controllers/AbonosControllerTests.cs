using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Peredent.Api.Controllers;
using Peredent.Api.Data;
using Peredent.Api.DTOs.Request;
using Peredent.Api.DTOs.Response;
using Peredent.Api.Models;
using Peredent.Api.Services;
using Xunit;

namespace Peredent.Api.Tests.UnitTests.Controllers;

// SCRUM-64 / SCRUM-65: registro de abonos del paciente y saldo pendiente
// recalculado contra el total del plan de tratamiento.
// SCRUM-63 (anulación): un abono no se borra, se anula y queda tachado.
public class AbonosControllerTests
{
    private const int IdUsuarioToken = 7;
    private const string PasswordAdmin = "Clave.Admin1";

    // Guarda lo que se escribe en el log para poder comprobar que la traza de la
    // anulación existe y que la contraseña nunca aparece ahí.
    private sealed class LoggerEspia : ILogger<AbonosController>
    {
        public List<string> Mensajes { get; } = new();

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Mensajes.Add(formatter(state, exception));
        }
    }

    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static AbonosController CrearController(
        ApplicationDbContext db, int? idUsuario = IdUsuarioToken, LoggerEspia? logger = null)
    {
        var controller = new AbonosController(db, new PasswordHasher(), logger ?? new LoggerEspia());
        var claims = idUsuario is null
            ? Array.Empty<Claim>()
            : new[] { new Claim("idUsuario", idUsuario.Value.ToString()) };

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test")) },
        };

        return controller;
    }

    // Admin logueado que confirma la anulación con su propia contraseña. El hash se
    // genera con el mismo IPasswordHasher del login, no a mano.
    private static async Task<Usuario> CrearAdminAsync(ApplicationDbContext db, int idUsuario = IdUsuarioToken, bool esAdmin = true)
    {
        var hasher = new PasswordHasher();
        var salt = hasher.GenerarSalt();

        var admin = new Usuario
        {
            IdUsuario = idUsuario,
            NombreUsuario = "admin",
            Salt = salt,
            ContrasenaHash = hasher.HashClave(PasswordAdmin, salt),
            Estado = true,
            EsAdmin = esAdmin,
        };

        db.Usuarios.Add(admin);
        await db.SaveChangesAsync();
        return admin;
    }

    private static async Task<Paciente> CrearPacienteAsync(ApplicationDbContext db)
    {
        var paciente = new Paciente
        {
            Nombres = "Juan",
            Apellidos = "Pérez",
            Telefono = "5555-5555",
            FechaRegistro = new DateTime(2026, 1, 1),
        };
        db.Pacientes.Add(paciente);
        await db.SaveChangesAsync();
        return paciente;
    }

    // Plan con las piezas que se le pasen y, opcionalmente, ya cerrado (historial).
    private static async Task<PresupuestoPlan> CrearPlanAsync(
        ApplicationDbContext db, int idPaciente, DateTime? fechaCierre, params decimal[] valores)
    {
        var plan = new PresupuestoPlan
        {
            IdPaciente = idPaciente,
            FechaInicioPlan = new DateTime(2026, 1, 1),
            FechaCierre = fechaCierre,
        };

        var numeroPieza = 0;
        foreach (var valor in valores)
        {
            numeroPieza++;
            plan.Piezas.Add(new PlanTratamiento
            {
                Pieza = numeroPieza.ToString(),
                Tratamiento = "Tratamiento",
                Valor = valor,
                IdEstadoTratamiento = 1,
            });
        }

        db.PresupuestosPlan.Add(plan);
        await db.SaveChangesAsync();
        return plan;
    }

    private static AbonoDto ExtraerAbono(ActionResult<AbonoDto> resultado)
    {
        var creado = Assert.IsType<CreatedAtActionResult>(resultado.Result);
        return Assert.IsType<AbonoDto>(creado.Value);
    }

    private static EstadoCuentaPlanDto ExtraerEstadoCuenta(ActionResult<EstadoCuentaPlanDto> resultado)
    {
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsType<EstadoCuentaPlanDto>(ok.Value);
    }

    // SCRUM-64: el abono guarda monto, fecha (asignada por el backend, no por la
    // base ni por el cliente) y el usuario del token; la respuesta trae el saldo
    // pendiente después del abono.
    [Fact]
    public async Task Registrar_GuardaMontoYFechaDelBackendYDevuelveElSaldoPendiente()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var controller = CrearController(db);

        var antes = DateTime.UtcNow.AddHours(-6);
        var resultado = await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 500m });
        var despues = DateTime.UtcNow.AddHours(-6);

        var dto = ExtraerAbono(resultado);
        Assert.Equal(500m, dto.Monto);
        Assert.Equal(2800m, dto.SaldoPendiente);

        var guardado = await db.AbonosPaciente.SingleAsync();
        Assert.Equal(500m, guardado.MontoAbono);
        Assert.Equal(IdUsuarioToken, guardado.IdUsuario);
        // La fecha queda guardada tal cual la asignó el backend: el mapeo no usa
        // valores por defecto de la base (nada de GETDATE() ni ValueGeneratedOnAdd).
        Assert.Equal(dto.Fecha, guardado.FechaAbono);
        Assert.NotEqual(default(DateTime), guardado.FechaAbono);
        Assert.InRange(guardado.FechaAbono, antes.AddMinutes(-1), despues.AddMinutes(1));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    public async Task Registrar_MontoNoPositivo_Devuelve400YNoGuardaNada(decimal monto)
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var controller = CrearController(db);

        var resultado = await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = monto });

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Empty(await db.AbonosPaciente.ToListAsync());
    }

    [Fact]
    public async Task Registrar_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var controller = CrearController(db);

        var resultado = await controller.Registrar(999, new RegistrarAbonoDto { Monto = 500m });

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Registrar_SinPlanActivo_Devuelve400()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, new DateTime(2026, 3, 1), 800m, 2500m);
        var controller = CrearController(db);

        var resultado = await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 500m });

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Empty(await db.AbonosPaciente.ToListAsync());
    }

    [Fact]
    public async Task Registrar_TokenSinIdUsuario_Devuelve401()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var controller = CrearController(db, idUsuario: null);

        var resultado = await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 500m });

        Assert.IsType<UnauthorizedResult>(resultado.Result);
        Assert.Empty(await db.AbonosPaciente.ToListAsync());
    }

    // SCRUM-65: el saldo de cada abono es el que quedó justo después de él, y el
    // historial sale del más reciente al más antiguo.
    [Fact]
    public async Task GetEstadoCuenta_CalculaElSaldoDeCadaAbono()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        var plan = await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);

        db.AbonosPaciente.Add(new AbonoPaciente
        {
            IdPresupuestoPlan = plan.IdPresupuestoPlan,
            IdUsuario = IdUsuarioToken,
            MontoAbono = 500m,
            FechaAbono = new DateTime(2026, 1, 10, 9, 0, 0),
        });
        db.AbonosPaciente.Add(new AbonoPaciente
        {
            IdPresupuestoPlan = plan.IdPresupuestoPlan,
            IdUsuario = IdUsuarioToken,
            MontoAbono = 300m,
            FechaAbono = new DateTime(2026, 1, 12, 9, 0, 0),
        });
        await db.SaveChangesAsync();

        var resultado = await CrearController(db).GetEstadoCuenta(paciente.IdPaciente);
        var estado = ExtraerEstadoCuenta(resultado);

        Assert.True(estado.TienePlan);
        Assert.True(estado.Activo);
        Assert.Equal(3300m, estado.Total);
        Assert.Equal(800m, estado.Abonado);
        Assert.Equal(2500m, estado.Saldo);

        Assert.Equal(2, estado.Abonos.Count);
        // Más reciente primero: el de 300 dejó 2500, el de 500 había dejado 2800.
        Assert.Equal(300m, estado.Abonos[0].Monto);
        Assert.Equal(2500m, estado.Abonos[0].SaldoPendiente);
        Assert.Equal(500m, estado.Abonos[1].Monto);
        Assert.Equal(2800m, estado.Abonos[1].SaldoPendiente);
    }

    // SCRUM-66 (primera parte): sin plan activo no hay nada que abonar, pero la
    // consulta del saldo no es un error: el frontend muestra el estado vacío.
    [Fact]
    public async Task GetEstadoCuenta_SinPlanActivo_DevuelveTienePlanFalse()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, new DateTime(2026, 3, 1), 800m);

        var resultado = await CrearController(db).GetEstadoCuenta(paciente.IdPaciente);
        var estado = ExtraerEstadoCuenta(resultado);

        Assert.False(estado.TienePlan);
        Assert.Equal(0m, estado.Saldo);
        Assert.Empty(estado.Abonos);
    }

    [Fact]
    public async Task GetEstadoCuenta_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();

        var resultado = await CrearController(db).GetEstadoCuenta(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    private static void AgregarAbono(ApplicationDbContext db, int idPresupuestoPlan, decimal monto, DateTime fecha, bool anulado = false)
    {
        db.AbonosPaciente.Add(new AbonoPaciente
        {
            IdPresupuestoPlan = idPresupuestoPlan,
            IdUsuario = IdUsuarioToken,
            MontoAbono = monto,
            FechaAbono = fecha,
            Anulado = anulado,
            FechaAnulacion = anulado ? fecha.AddDays(1) : null,
            IdUsuarioAnulacion = anulado ? IdUsuarioToken : null,
            MotivoAnulacion = anulado ? "Anulado en la prueba" : null,
        });
    }

    // SCRUM-65: un abono no puede dejar el plan en descubierto. Se permite
    // exactamente el saldo pendiente (queda en 0), pero no un centavo más.
    [Theory]
    [InlineData(3300, true)]
    [InlineData(3300.01, false)]
    public async Task Registrar_MontoContraElSaldo_ValidaElLimite(decimal monto, bool seEsperaOk)
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var controller = CrearController(db);

        var resultado = await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = monto });

        if (seEsperaOk)
        {
            Assert.Equal(0m, ExtraerAbono(resultado).SaldoPendiente);
        }
        else
        {
            Assert.IsType<BadRequestObjectResult>(resultado.Result);
            Assert.Empty(await db.AbonosPaciente.ToListAsync());
        }
    }

    // El descuento del plan baja el saldo disponible, no solo el total que se muestra.
    [Fact]
    public async Task Registrar_AplicaElDescuentoAlSaldoDisponible()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        var plan = await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        plan.CantidadDescuento = 300m;
        await db.SaveChangesAsync();
        var controller = CrearController(db);

        // 3300 - 300 = 3000 disponibles.
        var pasado = await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 3000.01m });
        Assert.IsType<BadRequestObjectResult>(pasado.Result);

        var resultado = await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 1000m });
        Assert.Equal(2000m, ExtraerAbono(resultado).SaldoPendiente);
    }

    [Fact]
    public async Task Registrar_VariasPiezas_SumaElTotalDelPlan()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m, 1200m);

        var resultado = await CrearController(db).Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 1500m });

        // 800 + 2500 + 1200 = 4500; 4500 - 1500 = 3000.
        Assert.Equal(3000m, ExtraerAbono(resultado).SaldoPendiente);
    }

    // El total no se congela: si editan el plan después de abonar, el saldo se
    // mueve y puede quedar a favor del paciente (negativo).
    [Fact]
    public async Task Registrar_PlanEditadoDespuesDeAbonar_DejaSaldoNegativoYBloqueaMasAbonos()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var controller = CrearController(db);

        ExtraerAbono(await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 3300m }));

        // El plan se edita y se quita la pieza de 2500: el total baja a 800.
        var piezaCara = await db.PlanesTratamiento.SingleAsync(pt => pt.Valor == 2500m);
        db.PlanesTratamiento.Remove(piezaCara);
        await db.SaveChangesAsync();

        var estado = ExtraerEstadoCuenta(await controller.GetEstadoCuenta(paciente.IdPaciente));
        Assert.Equal(800m, estado.Total);
        Assert.Equal(3300m, estado.Abonado);
        Assert.Equal(-2500m, estado.Saldo);

        // Con saldo a favor ya no cabe ningún abono nuevo.
        var resultado = await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 100m });
        Assert.IsType<BadRequestObjectResult>(resultado.Result);
    }

    // AJUSTE (SCRUM-65): el saldoPendiente de cada fila es el saldo corriente al
    // momento de ese abono contra el total ACTUAL del plan, así que si el plan se
    // edita después, todas las filas del historial se recalculan y siguen siendo
    // coherentes con el saldo que muestra el resumen.
    [Fact]
    public async Task GetEstadoCuenta_TrasEditarElPlan_RecalculaElSaldoDeCadaFila()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        var plan = await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        AgregarAbono(db, plan.IdPresupuestoPlan, 500m, new DateTime(2026, 1, 10));
        AgregarAbono(db, plan.IdPresupuestoPlan, 300m, new DateTime(2026, 1, 12));
        await db.SaveChangesAsync();

        var controller = CrearController(db);
        var antes = ExtraerEstadoCuenta(await controller.GetEstadoCuenta(paciente.IdPaciente));
        Assert.Equal(2800m, antes.Abonos[1].SaldoPendiente);
        Assert.Equal(2500m, antes.Abonos[0].SaldoPendiente);

        // El plan sube a 4300 al agregarle una pieza nueva.
        db.PlanesTratamiento.Add(new PlanTratamiento
        {
            IdPresupuestoPlan = plan.IdPresupuestoPlan,
            Pieza = "30",
            Tratamiento = "Tratamiento",
            Valor = 1000m,
            IdEstadoTratamiento = 1,
        });
        await db.SaveChangesAsync();

        var despues = ExtraerEstadoCuenta(await controller.GetEstadoCuenta(paciente.IdPaciente));
        Assert.Equal(4300m, despues.Total);
        Assert.Equal(800m, despues.Abonado);
        Assert.Equal(3500m, despues.Saldo);

        // Los abonos y su orden no cambian; su saldo sí, porque se recalcula.
        Assert.Equal(300m, despues.Abonos[0].Monto);
        Assert.Equal(3500m, despues.Abonos[0].SaldoPendiente);
        Assert.Equal(500m, despues.Abonos[1].Monto);
        Assert.Equal(3800m, despues.Abonos[1].SaldoPendiente);
    }

    // Con la misma fecha, el desempate es por ID (el orden en que se registraron).
    [Fact]
    public async Task GetEstadoCuenta_MismaFecha_AcumulaPorId()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        var plan = await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var mismaFecha = new DateTime(2026, 1, 10, 9, 0, 0);
        AgregarAbono(db, plan.IdPresupuestoPlan, 500m, mismaFecha);
        AgregarAbono(db, plan.IdPresupuestoPlan, 300m, mismaFecha);
        await db.SaveChangesAsync();

        var estado = ExtraerEstadoCuenta(await CrearController(db).GetEstadoCuenta(paciente.IdPaciente));

        // El de 300 se registró después (ID mayor), así que es el último
        // cronológicamente: queda primero por mostrarse del más reciente al más antiguo.
        Assert.Equal(300m, estado.Abonos[0].Monto);
        Assert.Equal(2500m, estado.Abonos[0].SaldoPendiente);
        Assert.Equal(500m, estado.Abonos[1].Monto);
        Assert.Equal(2800m, estado.Abonos[1].SaldoPendiente);
    }

    private static EstadoCuentaPacienteDto ExtraerEstadoCuentaPaciente(ActionResult<EstadoCuentaPacienteDto> resultado)
    {
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        return Assert.IsType<EstadoCuentaPacienteDto>(ok.Value);
    }

    // Plan con una sola pieza y fechas explícitas, para controlar el orden del
    // estado de cuenta (activo primero, cerrados del más reciente al más antiguo).
    private static async Task<PresupuestoPlan> AgregarPlanAsync(
        ApplicationDbContext db, int idPaciente, DateTime fechaInicio, DateTime? fechaCierre, decimal valor)
    {
        var plan = new PresupuestoPlan
        {
            IdPaciente = idPaciente,
            FechaInicioPlan = fechaInicio,
            FechaCierre = fechaCierre,
        };
        plan.Piezas.Add(new PlanTratamiento
        {
            Pieza = "16",
            Tratamiento = "Tratamiento",
            Valor = valor,
            IdEstadoTratamiento = 1,
        });

        db.PresupuestosPlan.Add(plan);
        await db.SaveChangesAsync();
        return plan;
    }

    // SCRUM-66: el estado de cuenta trae todos los planes, el activo primero y
    // después los cerrados del cierre más reciente al más antiguo.
    [Fact]
    public async Task GetEstadoCuentaPaciente_DevuelveElActivoPrimeroYLuegoLosCerrados()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        var planViejo = await AgregarPlanAsync(db, paciente.IdPaciente, new DateTime(2025, 5, 1), new DateTime(2025, 8, 1), 1000m);
        var planNuevo = await AgregarPlanAsync(db, paciente.IdPaciente, new DateTime(2026, 2, 1), new DateTime(2026, 4, 1), 2000m);
        var planActivo = await AgregarPlanAsync(db, paciente.IdPaciente, new DateTime(2026, 5, 1), null, 3300m);

        var estado = ExtraerEstadoCuentaPaciente(await CrearController(db).GetEstadoCuentaPaciente(paciente.IdPaciente));

        Assert.True(estado.TienePlanes);
        Assert.Equal(planActivo.IdPresupuestoPlan, estado.IdPlanActivo);
        Assert.Equal(3, estado.Planes.Count);
        Assert.Equal(planActivo.IdPresupuestoPlan, estado.Planes[0].IdPresupuestoPlan);
        Assert.True(estado.Planes[0].Activo);
        Assert.Equal(planNuevo.IdPresupuestoPlan, estado.Planes[1].IdPresupuestoPlan);
        Assert.False(estado.Planes[1].Activo);
        Assert.Equal<DateTime?>(new DateTime(2026, 4, 1), estado.Planes[1].FechaCierre);
        Assert.Equal(planViejo.IdPresupuestoPlan, estado.Planes[2].IdPresupuestoPlan);
    }

    // El resumen general suma los planes activos y cerrados: la deuda de un plan
    // cerrado sigue siendo del paciente.
    [Fact]
    public async Task GetEstadoCuentaPaciente_ResumenSumaTodosLosPlanes()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        var cerrado = await AgregarPlanAsync(db, paciente.IdPaciente, new DateTime(2025, 5, 1), new DateTime(2025, 8, 1), 1000m);
        var activo = await AgregarPlanAsync(db, paciente.IdPaciente, new DateTime(2026, 5, 1), null, 3300m);
        AgregarAbono(db, cerrado.IdPresupuestoPlan, 400m, new DateTime(2025, 6, 1));
        AgregarAbono(db, activo.IdPresupuestoPlan, 300m, new DateTime(2026, 6, 1));
        await db.SaveChangesAsync();

        var estado = ExtraerEstadoCuentaPaciente(await CrearController(db).GetEstadoCuentaPaciente(paciente.IdPaciente));

        // Tratamientos: 3300 + 1000 = 4300. Abonado: 300 + 400 = 700.
        Assert.Equal(2, estado.Resumen.TotalPlanes);
        Assert.Equal(4300m, estado.Resumen.TotalTratamientos);
        Assert.Equal(700m, estado.Resumen.TotalAbonado);
        Assert.Equal(3600m, estado.Resumen.SaldoPendiente);

        // El plan cerrado conserva su saldo y su historial (solo lectura).
        Assert.Equal(600m, estado.Planes[1].Saldo);
        Assert.Single(estado.Planes[1].Abonos);
        Assert.Equal(400m, estado.Planes[1].Abonos[0].Monto);
    }

    [Fact]
    public async Task GetEstadoCuentaPaciente_SinPlanes_DevuelveTienePlanesFalse()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);

        var estado = ExtraerEstadoCuentaPaciente(await CrearController(db).GetEstadoCuentaPaciente(paciente.IdPaciente));

        Assert.False(estado.TienePlanes);
        Assert.Null(estado.IdPlanActivo);
        Assert.Empty(estado.Planes);
        Assert.Equal(0m, estado.Resumen.SaldoPendiente);
    }

    // Con solo planes cerrados se ve el historial, pero no hay plan activo sobre el
    // que abonar: el estado de cuenta lo marca y el POST lo rechaza.
    [Fact]
    public async Task GetEstadoCuentaPaciente_SinPlanActivo_MuestraLosCerradosSinPoderAbonar()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await AgregarPlanAsync(db, paciente.IdPaciente, new DateTime(2025, 5, 1), new DateTime(2025, 8, 1), 1000m);
        var controller = CrearController(db);

        var estado = ExtraerEstadoCuentaPaciente(await controller.GetEstadoCuentaPaciente(paciente.IdPaciente));

        Assert.True(estado.TienePlanes);
        Assert.Null(estado.IdPlanActivo);
        Assert.False(estado.Planes[0].Activo);
        Assert.Equal("Juan Pérez", estado.NombrePaciente);

        var resultado = await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 100m });
        Assert.IsType<BadRequestObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task GetEstadoCuentaPaciente_PacienteInexistente_Devuelve404()
    {
        using var db = CrearContexto();

        var resultado = await CrearController(db).GetEstadoCuentaPaciente(999);

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    // La historia es de la asistente, pero el odontólogo entra con el mismo rol
    // autenticado: el controller exige autenticación y no restringe Roles ni pide
    // una policy. Si alguien agrega [Authorize(Roles = ...)] este test lo avisa.
    [Fact]
    public void AbonosController_ExigeAutenticacion_PeroNoRestringeRol()
    {
        var autorizaciones = typeof(AbonosController)
            .GetCustomAttributes<AuthorizeAttribute>(inherit: true)
            .ToList();

        Assert.Contains(autorizaciones, a => a.Roles is null && a.Policy is null);
        Assert.DoesNotContain(autorizaciones, a => a.Roles is not null || a.Policy is not null);
    }

    // ------------------------------------------------------------------
    // SCRUM-63 (anulación): un abono no se borra, se anula y queda tachado.
    // ------------------------------------------------------------------

    [Fact]
    public async Task Anular_ComoAdmin_MarcaElAbonoYLiberaElSaldo()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var controller = CrearController(db);
        var abono = ExtraerAbono(await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 500m }));

        var antes = DateTime.UtcNow.AddHours(-6);
        var resultado = await controller.Anular(
            paciente.IdPaciente,
            abono.IdAbonoPaciente,
            new AnularAbonoDto { Password = PasswordAdmin, Motivo = "  Se equivocó el monto  " });
        var despues = DateTime.UtcNow.AddHours(-6);

        // El saldo se recupera por completo y el abono deja de contar.
        var estado = ExtraerEstadoCuenta(resultado);
        Assert.Equal(3300m, estado.Total);
        Assert.Equal(0m, estado.Abonado);
        Assert.Equal(3300m, estado.Saldo);

        // Pero sigue en el historial, con su traza y sin saldo propio.
        var fila = Assert.Single(estado.Abonos);
        Assert.True(fila.Anulado);
        Assert.Null(fila.SaldoPendiente);
        Assert.Equal("Se equivocó el monto", fila.MotivoAnulacion);
        Assert.Equal("admin", fila.UsuarioAnulacion);
        Assert.NotNull(fila.FechaAnulacion);

        var guardado = await db.AbonosPaciente.SingleAsync();
        Assert.True(guardado.Anulado);
        Assert.Equal(IdUsuarioToken, guardado.IdUsuarioAnulacion);
        Assert.InRange(guardado.FechaAnulacion!.Value, antes.AddMinutes(-1), despues.AddMinutes(1));
    }

    [Theory]
    [InlineData("otra-clave")]
    [InlineData("")]
    [InlineData(null)]
    public async Task Anular_PasswordIncorrectaOVacia_Devuelve400YNoAnula(string? password)
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var controller = CrearController(db);
        var abono = ExtraerAbono(await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 500m }));

        var resultado = await controller.Anular(paciente.IdPaciente, abono.IdAbonoPaciente, new AnularAbonoDto { Password = password });

        var malo = Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Contains("No se pudo confirmar la contraseña.", malo.Value!.ToString());
        Assert.False((await db.AbonosPaciente.SingleAsync()).Anulado);
    }

    // Un admin que ya no existe en la base no puede confirmar: mismo 400 genérico.
    [Fact]
    public async Task Anular_UsuarioDelTokenInexistente_Devuelve400()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var controller = CrearController(db);
        var abono = ExtraerAbono(await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 500m }));

        var resultado = await controller.Anular(paciente.IdPaciente, abono.IdAbonoPaciente, new AnularAbonoDto { Password = PasswordAdmin });

        Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.False((await db.AbonosPaciente.SingleAsync()).Anulado);
    }

    [Fact]
    public async Task Anular_AbonoInexistente_Devuelve404()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);

        var resultado = await CrearController(db).Anular(paciente.IdPaciente, 999, new AnularAbonoDto { Password = PasswordAdmin });

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact]
    public async Task Anular_AbonoDeOtroPaciente_Devuelve404()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        var otro = await CrearPacienteAsync(db);
        var planAjeno = await CrearPlanAsync(db, otro.IdPaciente, null, 1000m);
        AgregarAbono(db, planAjeno.IdPresupuestoPlan, 200m, new DateTime(2026, 1, 10));
        await db.SaveChangesAsync();
        var abonoAjeno = await db.AbonosPaciente.SingleAsync();

        var resultado = await CrearController(db).Anular(paciente.IdPaciente, abonoAjeno.IdAbonoPaciente, new AnularAbonoDto { Password = PasswordAdmin });

        Assert.IsType<NotFoundObjectResult>(resultado.Result);
        Assert.False((await db.AbonosPaciente.SingleAsync()).Anulado);
    }

    [Fact]
    public async Task Anular_AbonoDePlanCerrado_Devuelve400()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        var cerrado = await CrearPlanAsync(db, paciente.IdPaciente, new DateTime(2026, 3, 1), 1000m);
        AgregarAbono(db, cerrado.IdPresupuestoPlan, 200m, new DateTime(2026, 1, 10));
        await db.SaveChangesAsync();
        var abono = await db.AbonosPaciente.SingleAsync();

        var resultado = await CrearController(db).Anular(paciente.IdPaciente, abono.IdAbonoPaciente, new AnularAbonoDto { Password = PasswordAdmin });

        var malo = Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Contains("plan ya cerrado", malo.Value!.ToString());
        Assert.False((await db.AbonosPaciente.SingleAsync()).Anulado);
    }

    [Fact]
    public async Task Anular_AbonoYaAnulado_Devuelve400()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        var plan = await CrearPlanAsync(db, paciente.IdPaciente, null, 1000m);
        AgregarAbono(db, plan.IdPresupuestoPlan, 200m, new DateTime(2026, 1, 10), anulado: true);
        await db.SaveChangesAsync();
        var abono = await db.AbonosPaciente.SingleAsync();

        var resultado = await CrearController(db).Anular(paciente.IdPaciente, abono.IdAbonoPaciente, new AnularAbonoDto { Password = PasswordAdmin });

        var malo = Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Contains("ya está anulado", malo.Value!.ToString());
    }

    [Fact]
    public async Task Anular_MotivoMuyLargo_Devuelve400YNoAnula()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var controller = CrearController(db);
        var abono = ExtraerAbono(await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 500m }));

        var resultado = await controller.Anular(
            paciente.IdPaciente,
            abono.IdAbonoPaciente,
            new AnularAbonoDto { Password = PasswordAdmin, Motivo = new string('a', 301) });

        var malo = Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Contains("300", malo.Value!.ToString());
        Assert.False((await db.AbonosPaciente.SingleAsync()).Anulado);
    }

    // Alcanzado el tope de anulados del plan, no se admite uno más.
    [Fact]
    public async Task Anular_AlcanzaElMaximoDeAnuladosPorPlan_Devuelve400()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        var plan = await CrearPlanAsync(db, paciente.IdPaciente, null, 1000m);
        for (var i = 0; i < 50; i++)
        {
            AgregarAbono(db, plan.IdPresupuestoPlan, 10m, new DateTime(2026, 1, 1).AddDays(i), anulado: true);
        }
        AgregarAbono(db, plan.IdPresupuestoPlan, 100m, new DateTime(2026, 3, 1));
        await db.SaveChangesAsync();
        var vigente = await db.AbonosPaciente.SingleAsync(a => !a.Anulado);

        var resultado = await CrearController(db).Anular(paciente.IdPaciente, vigente.IdAbonoPaciente, new AnularAbonoDto { Password = PasswordAdmin });

        var malo = Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.Contains("máximo", malo.Value!.ToString());
        Assert.False((await db.AbonosPaciente.SingleAsync(a => a.IdAbonoPaciente == vigente.IdAbonoPaciente)).Anulado);
    }

    [Fact]
    public async Task Anular_TokenSinIdUsuario_Devuelve401()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        var plan = await CrearPlanAsync(db, paciente.IdPaciente, null, 1000m);
        AgregarAbono(db, plan.IdPresupuestoPlan, 200m, new DateTime(2026, 1, 10));
        await db.SaveChangesAsync();
        var abono = await db.AbonosPaciente.SingleAsync();

        var resultado = await CrearController(db, idUsuario: null)
            .Anular(paciente.IdPaciente, abono.IdAbonoPaciente, new AnularAbonoDto { Password = PasswordAdmin });

        Assert.IsType<UnauthorizedResult>(resultado.Result);
    }

    // La traza de respaldo dice quién anuló qué y cuándo, y nunca la contraseña.
    [Fact]
    public async Task Anular_RegistraLaTrazaSinLaContrasena()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        var plan = await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        AgregarAbono(db, plan.IdPresupuestoPlan, 500m, new DateTime(2026, 1, 10));
        await db.SaveChangesAsync();
        var abono = await db.AbonosPaciente.SingleAsync();
        var logger = new LoggerEspia();

        await CrearController(db, logger: logger)
            .Anular(paciente.IdPaciente, abono.IdAbonoPaciente, new AnularAbonoDto { Password = PasswordAdmin, Motivo = "Error" });

        var traza = Assert.Single(logger.Mensajes);
        Assert.Contains("Abono anulado", traza);
        Assert.Contains($"idUsuario={IdUsuarioToken}", traza);
        Assert.Contains($"idAbono={abono.IdAbonoPaciente}", traza);
        Assert.Contains($"idPresupuestoPlan={plan.IdPresupuestoPlan}", traza);
        Assert.Contains($"idPaciente={paciente.IdPaciente}", traza);
        Assert.Contains("monto=500", traza);
        Assert.DoesNotContain(PasswordAdmin, traza);
    }

    // Tras anular, el saldo vuelve y se puede abonar otra vez hasta ese saldo.
    [Fact]
    public async Task Anular_SaldoSeRecuperaYPermiteVolverAAbonarHastaElSaldoRestaurado()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        var controller = CrearController(db);

        var abono = ExtraerAbono(await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 3300m }));
        // El plan quedó saldado: no cabe otro abono.
        Assert.IsType<BadRequestObjectResult>(
            (await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 100m })).Result);

        ExtraerEstadoCuenta(await controller.Anular(
            paciente.IdPaciente, abono.IdAbonoPaciente, new AnularAbonoDto { Password = PasswordAdmin }));

        // Al anular se libera el saldo completo.
        var otro = ExtraerAbono(await controller.Registrar(paciente.IdPaciente, new RegistrarAbonoDto { Monto = 3300m }));
        Assert.Equal(0m, otro.SaldoPendiente);

        var estado = ExtraerEstadoCuenta(await controller.GetEstadoCuenta(paciente.IdPaciente));
        Assert.Equal(3300m, estado.Abonado);
        Assert.Equal(0m, estado.Saldo);
        Assert.Equal(2, estado.Abonos.Count);
    }

    // Un abono anulado no mueve el saldo corriente de las demás filas.
    [Fact]
    public async Task GetEstadoCuenta_NoCuentaElAnuladoEnElSaldoCorrienteDeLasDemasFilas()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        var plan = await CrearPlanAsync(db, paciente.IdPaciente, null, 800m, 2500m);
        AgregarAbono(db, plan.IdPresupuestoPlan, 500m, new DateTime(2026, 1, 10));
        AgregarAbono(db, plan.IdPresupuestoPlan, 300m, new DateTime(2026, 1, 12));
        await db.SaveChangesAsync();
        var controller = CrearController(db);
        var deQuinientos = await db.AbonosPaciente.SingleAsync(a => a.MontoAbono == 500m);

        ExtraerEstadoCuenta(await controller.Anular(
            paciente.IdPaciente, deQuinientos.IdAbonoPaciente, new AnularAbonoDto { Password = PasswordAdmin }));

        var estado = ExtraerEstadoCuenta(await controller.GetEstadoCuenta(paciente.IdPaciente));

        Assert.Equal(300m, estado.Abonado);
        Assert.Equal(3000m, estado.Saldo);
        Assert.Equal(2, estado.Abonos.Count);
        // Más reciente primero: el de 300 (vigente) dejó 3000 y el anulado no deja saldo.
        Assert.Equal(300m, estado.Abonos[0].Monto);
        Assert.Equal(3000m, estado.Abonos[0].SaldoPendiente);
        Assert.True(estado.Abonos[1].Anulado);
        Assert.Null(estado.Abonos[1].SaldoPendiente);
    }

    // Un plan cerrado con abonos anulados muestra el saldo que realmente se debe.
    [Fact]
    public async Task GetEstadoCuenta_PlanCerradoConAbonosAnulados_MuestraElSaldoCorrecto()
    {
        using var db = CrearContexto();
        var paciente = await CrearPacienteAsync(db);
        await CrearAdminAsync(db);
        var cerrado = await CrearPlanAsync(db, paciente.IdPaciente, new DateTime(2026, 3, 1), 1000m);
        AgregarAbono(db, cerrado.IdPresupuestoPlan, 400m, new DateTime(2026, 1, 10), anulado: true);
        AgregarAbono(db, cerrado.IdPresupuestoPlan, 200m, new DateTime(2026, 1, 12));
        await db.SaveChangesAsync();

        var estado = ExtraerEstadoCuentaPaciente(await CrearController(db).GetEstadoCuentaPaciente(paciente.IdPaciente));

        var plan = Assert.Single(estado.Planes);
        Assert.False(plan.Activo);
        Assert.Equal(1000m, plan.Total);
        Assert.Equal(200m, plan.Abonado);
        Assert.Equal(800m, plan.Saldo);
        Assert.Equal(2, plan.Abonos.Count);
        Assert.True(plan.Abonos[1].Anulado);

        Assert.Equal(200m, estado.Resumen.TotalAbonado);
        Assert.Equal(800m, estado.Resumen.SaldoPendiente);
    }

    // La anulación está protegida con la policy SoloAdmin (el claim esAdmin del JWT).
    [Fact]
    public void Anular_ExigeLaPolicySoloAdmin()
    {
        var metodo = typeof(AbonosController).GetMethod(nameof(AbonosController.Anular));

        var autorizacion = metodo!.GetCustomAttribute<AuthorizeAttribute>();

        Assert.NotNull(autorizacion);
        Assert.Equal("SoloAdmin", autorizacion!.Policy);
    }
}
