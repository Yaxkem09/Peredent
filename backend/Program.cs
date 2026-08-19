using DotNetEnv;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Peredent.Api.Data;

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

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

const string FrontendCorsPolicy = "Frontend";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        var allowedOrigins = new List<string> { "https://peredent.netlify.app" };
        if (builder.Environment.IsDevelopment())
        {
            allowedOrigins.Add("http://localhost:5173");
        }

        policy.WithOrigins(allowedOrigins.ToArray())
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
app.UseAuthorization();
app.MapControllers();

app.Run();
