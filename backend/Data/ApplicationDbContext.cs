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

    public DbSet<HistoriaMedica> HistoriasMedicas => Set<HistoriaMedica>();

    public DbSet<Condicion> Condiciones => Set<Condicion>();

    public DbSet<HistoriaCondicion> HistoriasCondiciones => Set<HistoriaCondicion>();

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

        modelBuilder.Entity<HistoriaMedica>(entity =>
        {
            entity.ToTable("Historia_Medica");
            entity.HasKey(h => h.IdHistoriaMedica);
            entity.Property(h => h.IdHistoriaMedica).HasColumnName("ID_HistoriaMedica");
            entity.Property(h => h.IdPaciente).HasColumnName("ID_Paciente");
            entity.Property(h => h.ObservacionesGenerales).HasColumnName("Observaciones_Generales").HasMaxLength(500);

            entity.HasIndex(h => h.IdPaciente).IsUnique();
        });

        modelBuilder.Entity<Condicion>(entity =>
        {
            entity.ToTable("Condicion");
            entity.HasKey(c => c.IdCondicion);
            entity.Property(c => c.IdCondicion).HasColumnName("ID_Condicion");
            entity.Property(c => c.NombreCondicion).HasColumnName("Nombre_Condicion").HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<HistoriaCondicion>(entity =>
        {
            entity.ToTable("Historia_Condicion");
            entity.HasKey(hc => hc.IdHistoriaCondicion);
            entity.Property(hc => hc.IdHistoriaCondicion).HasColumnName("ID_HistoriaCondicion");
            entity.Property(hc => hc.IdHistoriaMedica).HasColumnName("ID_HistoriaMedica");
            entity.Property(hc => hc.IdCondicion).HasColumnName("ID_Condicion");
            entity.Property(hc => hc.ObservacionCondicion).HasColumnName("ObservacionCondicion").HasMaxLength(300);

            entity.HasIndex(hc => new { hc.IdHistoriaMedica, hc.IdCondicion }).IsUnique();

            entity.HasOne(hc => hc.Condicion)
                  .WithMany()
                  .HasForeignKey(hc => hc.IdCondicion);
        });

        modelBuilder.Entity<HistoriaMedica>()
            .HasMany(h => h.Condiciones)
            .WithOne()
            .HasForeignKey(hc => hc.IdHistoriaMedica);
    }
}
