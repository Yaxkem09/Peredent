using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using Peredent.Api.Data;

// Solo existe .env en local (esta gitignored); en la nube las variables de
// entorno las inyecta la plataforma directamente, no hace falta este archivo.
if (File.Exists(".env"))
{
    Env.Load();
}

var builder = WebApplication.CreateBuilder(args);

var connectionString = new MySqlConnectionStringBuilder
{
    Server = builder.Configuration["DB_HOST"] ?? "localhost",
    Port = uint.Parse(builder.Configuration["DB_PORT"] ?? "3306"),
    Database = builder.Configuration["DB_NAME"] ?? "Peredent",
    UserID = builder.Configuration["DB_USER"] ?? "root",
    Password = builder.Configuration["DB_PASSWORD"] ?? "",
}.ConnectionString;

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

const string FrontendCorsPolicy = "Frontend";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.WithOrigins("http://localhost:5173")
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
