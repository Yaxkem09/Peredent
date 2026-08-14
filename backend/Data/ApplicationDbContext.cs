using Microsoft.EntityFrameworkCore;
using Peredent.Api.Models;

namespace Peredent.Api.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<Usuario> Usuarios => Set<Usuario>();

    public DbSet<Rol> Roles => Set<Rol>();

    public DbSet<Paciente> Pacientes => Set<Paciente>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Rol>(entity =>
        {
            entity.ToTable("Rol");
            entity.HasKey(r => r.IdRol);
            entity.Property(r => r.IdRol).HasColumnName("ID_Rol");
            entity.Property(r => r.NombreRol).HasColumnName("NombreRol").HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.ToTable("Usuario");
            entity.HasKey(u => u.IdUsuario);
            entity.Property(u => u.IdUsuario).HasColumnName("ID_Usuario");
            entity.Property(u => u.NombreUsuario).HasColumnName("NombreUsuario").HasMaxLength(50).IsRequired();
            entity.Property(u => u.Salt).HasColumnName("Salt").HasMaxLength(36).IsRequired();
            entity.Property(u => u.ContrasenaHash).HasColumnName("Contrasena_Hash").HasMaxLength(64).IsRequired();
            entity.Property(u => u.IdRol).HasColumnName("ID_Rol");
            entity.Property(u => u.Estado).HasColumnName("Estado");
            entity.Property(u => u.UltimoAcceso).HasColumnName("UltimoAcceso");

            entity.HasOne(u => u.Rol)
                  .WithMany()
                  .HasForeignKey(u => u.IdRol);
        });

        modelBuilder.Entity<Paciente>(entity =>
        {
            entity.ToTable("Paciente");
            entity.HasKey(p => p.IdPaciente);
            entity.Property(p => p.IdPaciente).HasColumnName("ID_Paciente");
            entity.Property(p => p.Nombres).HasColumnName("Nombres").HasMaxLength(100).IsRequired();
            entity.Property(p => p.Apellidos).HasColumnName("Apellidos").HasMaxLength(100).IsRequired();
            entity.Property(p => p.Sexo).HasColumnName("Sexo").HasMaxLength(10);
            entity.Property(p => p.FechaNacimiento).HasColumnName("Fecha_Nacimiento");
            entity.Property(p => p.Telefono).HasColumnName("Telefono").HasMaxLength(20).IsRequired();
            entity.Property(p => p.Correo).HasColumnName("Correo").HasMaxLength(100);
            entity.Property(p => p.Direccion).HasColumnName("Direccion").HasMaxLength(200);
            entity.Property(p => p.NombreEncargado).HasColumnName("Nombre_Encargado").HasMaxLength(100);
            entity.Property(p => p.TelefonoEncargado).HasColumnName("Telefono_Encargado").HasMaxLength(20);
            entity.Property(p => p.FechaRegistro).HasColumnName("Fecha_Registro");
        });
    }
}
