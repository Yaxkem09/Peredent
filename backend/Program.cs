using System.Security.Claims;
using System.Text;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Peredent.Api.Data;
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
builder.Services.AddSwaggerGen();

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
