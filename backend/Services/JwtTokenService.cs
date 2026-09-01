using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Peredent.Api.Models;

namespace Peredent.Api.Services;

public class JwtTokenService : IJwtTokenService
{
    private readonly byte[] _clave;
    private readonly int _expiracionMinutos;

    public JwtTokenService(IConfiguration configuration)
    {
        // JWT_SECRET ya fue validada (presente y >= 32 bytes) al arrancar la app en Program.cs.
        _clave = Encoding.UTF8.GetBytes(configuration["JWT_SECRET"]!);
        _expiracionMinutos = int.TryParse(configuration["JWT_EXPIRATION_MINUTES"], out var minutos)
            ? minutos
            : 480;
    }

    public string GenerarToken(Usuario usuario)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, usuario.NombreUsuario),
            new(ClaimTypes.Role, usuario.Rol?.NombreRol ?? string.Empty),
            new("esAdmin", usuario.EsAdmin ? "true" : "false"),
        };

        var credenciales = new SigningCredentials(new SymmetricSecurityKey(_clave), SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_expiracionMinutos),
            signingCredentials: credenciales);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
