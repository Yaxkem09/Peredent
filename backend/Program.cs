using System.Security.Claims;
using System.Text;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Peredent.Api.Data;
using Peredent.Api.Options;
using Peredent.Api.Services;

// Solo existe .env en local (esta gitignored); en la nube las variables de
// entorno las inyecta la plataforma directamente, no hace falta este archivo.
if (File.Exists(".env"))
{
    Env.Load();
}

var builder = WebApplication.CreateBuilder(args);

var dbHost = builder.Configuration["DB_HOST"];
if (string.IsNullOrWhiteSpace(dbHost))
{
    throw new InvalidOperationException("DB_HOST no está configurada");
}

var connectionStringBuilder = new SqlConnectionStringBuilder
{
    DataSource = dbHost,
    InitialCatalog = builder.Configuration["DB_NAME"] ?? "Peredent",
    TrustServerCertificate = true,
};

var dbUser = builder.Configuration["DB_USER"];
if (string.IsNullOrWhiteSpace(dbUser))
{
    // Sin DB_USER en el .env, se conecta con autenticación de Windows
    // (el modo por defecto de SSMS / LocalDB en desarrollo local).
    connectionStringBuilder.IntegratedSecurity = true;
}
else
{
    connectionStringBuilder.UserID = dbUser;
    connectionStringBuilder.Password = builder.Configuration["DB_PASSWORD"] ?? "";
}

var connectionString = connectionStringBuilder.ConnectionString;

var jwtSecret = builder.Configuration["JWT_SECRET"];
if (string.IsNullOrWhiteSpace(jwtSecret))
{
    throw new InvalidOperationException("JWT_SECRET no está configurada");
}

if (Encoding.UTF8.GetByteCount(jwtSecret) < 32)
{
    throw new InvalidOperationException("JWT_SECRET debe tener al menos 32 bytes (256 bits) para HMACSHA256");
}

// Recordatorios por WhatsApp: apagados por defecto, así el CI y los demás
// desarrolladores arrancan sin estas variables. Solo cuando se encienden se
// exige el Phone Number ID y el token de la WhatsApp Cloud API.
var whatsAppEnabled = bool.TryParse(builder.Configuration["WHATSAPP_ENABLED"], out var whatsAppEnabledConfigurado)
    && whatsAppEnabledConfigurado;
var whatsAppPhoneNumberId = builder.Configuration["WHATSAPP_PHONE_NUMBER_ID"];
var whatsAppToken = builder.Configuration["WHATSAPP_TOKEN"];

if (whatsAppEnabled && string.IsNullOrWhiteSpace(whatsAppPhoneNumberId))
{
    throw new InvalidOperationException("WHATSAPP_PHONE_NUMBER_ID no está configurada (requerida cuando WHATSAPP_ENABLED=true)");
}

if (whatsAppEnabled && string.IsNullOrWhiteSpace(whatsAppToken))
{
    throw new InvalidOperationException("WHATSAPP_TOKEN no está configurada (requerida cuando WHATSAPP_ENABLED=true)");
}

var jwtExpirationMinutes = int.TryParse(builder.Configuration["JWT_EXPIRATION_MINUTES"], out var minutosConfigurados)
    ? minutosConfigurados
    : 480; // 8 horas: un turno clínico completo

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

// Singleton: no depende del DbContext ni de estado por-request, solo lee
// JWT_SECRET/JWT_EXPIRATION_MINUTES una vez al construirse.
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

// Scoped: usa ApplicationDbContext, que también es scoped por request.
builder.Services.AddScoped<ICitaService, CitaService>();
builder.Services.AddScoped<IBloqueoAgendaService, BloqueoAgendaService>();
builder.Services.AddScoped<IPlanTratamientoService, PlanTratamientoService>();

// Singleton: sin estado, solo funciones puras de hashing.
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();

// Singleton: sin estado, arma el PDF del presupuesto a partir del DTO recibido.
builder.Services.AddSingleton<IPresupuestoPdfService, PresupuestoPdfService>();

// Singleton: sin estado, arma el PDF de la receta a partir del DTO recibido.
builder.Services.AddSingleton<IRecetaPdfService, RecetaPdfService>();

builder.Services.Configure<R2Options>(builder.Configuration.GetSection("R2"));

// Scoped: crea un AmazonS3Client por request; ver R2StorageService para el
// detalle de por qué el AmazonS3Config necesita esas propiedades para R2.
builder.Services.AddScoped<IR2StorageService, R2StorageService>();

// Nombres planos (WHATSAPP_*, REMINDERS_API_KEY) en vez de una sección, igual
// que DB_HOST y JWT_SECRET; los que no vienen conservan el default de la clase.
builder.Services.Configure<WhatsAppOptions>(options =>
{
    options.Enabled = whatsAppEnabled;
    options.PhoneNumberId = whatsAppPhoneNumberId ?? string.Empty;
    options.AccessToken = whatsAppToken ?? string.Empty;

    var apiVersion = builder.Configuration["WHATSAPP_API_VERSION"];
    if (!string.IsNullOrWhiteSpace(apiVersion))
    {
        options.ApiVersion = apiVersion;
    }

    var templateName = builder.Configuration["WHATSAPP_TEMPLATE_NAME"];
    if (!string.IsNullOrWhiteSpace(templateName))
    {
        options.TemplateName = templateName;
    }

    var templateLanguage = builder.Configuration["WHATSAPP_TEMPLATE_LANGUAGE"];
    if (!string.IsNullOrWhiteSpace(templateLanguage))
    {
        options.TemplateLanguage = templateLanguage;
    }
});

builder.Services.Configure<RecordatoriosOptions>(options =>
{
    options.ApiKey = builder.Configuration["REMINDERS_API_KEY"] ?? string.Empty;
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateLifetime = true,
            // JwtTokenService no emite iss/aud (un solo backend, un solo frontend
            // conocido hoy); si eso cambia, activar estas dos validaciones.
            ValidateIssuer = false,
            ValidateAudience = false,
            // Explícito (coincide con el default de ClaimsIdentity) para que
            // [Authorize(Roles=...)] siga funcionando aunque cambie el default
            // de MapInboundClaims más adelante: JwtSecurityTokenHandler mapea el
            // claim corto "role" del token de vuelta a ClaimTypes.Role al validar.
            RoleClaimType = ClaimTypes.Role,
            // ClockSkew por default (5 min) — no se sobreescribe, ya es razonable.
        };
    });

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Pegar solo el token, sin el prefijo \"Bearer \" (Swagger lo agrega solo).",
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
            },
            Array.Empty<string>()
        },
    });
});

// esAdmin es un permiso independiente del Rol clínico (Odontólogo/Asistente),
// por eso es una policy sobre el claim "esAdmin" y no [Authorize(Roles=...)].
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SoloAdmin", policy => policy.RequireClaim("esAdmin", "true"));
});

const string FrontendCorsPolicy = "Frontend";

// CORS_ALLOWED_ORIGINS (coma-separado) permite sobreescribir los orígenes sin
// tocar código, igual que DB_HOST; si no está definida se usa Cors:AllowedOrigins
// de appsettings.json / appsettings.{Environment}.json.
var corsEnvOverride = builder.Configuration["CORS_ALLOWED_ORIGINS"];
var allowedOrigins = !string.IsNullOrWhiteSpace(corsEnvOverride)
    ? corsEnvOverride.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    : builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

// Además de los orígenes fijos, se permite cualquier branch deploy de Netlify
// del sitio "peredent" (https://{branch}--peredent.netlify.app).
const string NetlifyBranchDeploySuffix = "--peredent.netlify.app";

bool IsOriginAllowed(string origin)
{
    if (allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
    {
        return true;
    }

    return Uri.TryCreate(origin, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && uri.Host.EndsWith(NetlifyBranchDeploySuffix, StringComparison.OrdinalIgnoreCase);
}

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.SetIsOriginAllowed(IsOriginAllowed)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(FrontendCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
