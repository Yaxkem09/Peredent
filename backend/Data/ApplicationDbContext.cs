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

    public DbSet<EstadoTratamiento> EstadosTratamiento => Set<EstadoTratamiento>();

    public DbSet<PresupuestoPlan> PresupuestosPlan => Set<PresupuestoPlan>();

    public DbSet<PlanTratamiento> PlanesTratamiento => Set<PlanTratamiento>();

    public DbSet<EstadoCita> EstadosCita => Set<EstadoCita>();

    public DbSet<Cita> Citas => Set<Cita>();
    public DbSet<Endodoncia> Endodoncias => Set<Endodoncia>();

    public DbSet<Protesis> Protesis => Set<Protesis>();
    public DbSet<BloqueoAgenda> BloqueosAgenda => Set<BloqueoAgenda>();

    public DbSet<DatosRecetario> DatosRecetarios => Set<DatosRecetario>();

    public DbSet<Recetario> Recetarios => Set<Recetario>();

    public DbSet<MedicamentoReceta> MedicamentosReceta => Set<MedicamentoReceta>();

    public DbSet<Panoramica> Panoramicas => Set<Panoramica>();

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
            entity.Property(u => u.CorreoUsuario).HasColumnName("CorreoUsuario").HasColumnType("varchar(150)");
            entity.Property(u => u.Salt).HasColumnName("Salt").HasMaxLength(36).IsRequired();
            entity.Property(u => u.ContrasenaHash).HasColumnName("Contrasena_Hash").HasMaxLength(64).IsRequired();
            entity.Property(u => u.IdRol).HasColumnName("ID_Rol");
            entity.Property(u => u.Estado).HasColumnName("Estado");
            entity.Property(u => u.UltimoAcceso).HasColumnName("UltimoAcceso");
            entity.Property(u => u.EsAdmin).HasColumnName("EsAdmin");

            entity.HasOne(u => u.Rol)
                  .WithMany()
                  .HasForeignKey(u => u.IdRol)
                  .IsRequired(false);
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
            entity.Property(p => p.Nit).HasColumnName("NIT").HasColumnType("varchar(15)").IsRequired();
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

        modelBuilder.Entity<EstadoTratamiento>(entity =>
        {
            entity.ToTable("EstadoTratamiento");
            entity.HasKey(e => e.IdEstadoTratamiento);
            entity.Property(e => e.IdEstadoTratamiento).HasColumnName("ID_EstadoTratamiento");
            entity.Property(e => e.Nombre).HasColumnName("EstadoTratamiento").HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<PresupuestoPlan>(entity =>
        {
            entity.ToTable("PresupuestoPlan");
            entity.HasKey(p => p.IdPresupuestoPlan);
            entity.Property(p => p.IdPresupuestoPlan).HasColumnName("ID_PresupuestoPlan");
            entity.Property(p => p.IdPaciente).HasColumnName("ID_Paciente");
            entity.Property(p => p.FechaInicioPlan).HasColumnName("FechaInicioPlan");
            entity.Property(p => p.CantidadDescuento).HasColumnName("CantidadDescuento").HasColumnType("decimal(10,2)");
            entity.Property(p => p.FechaCierre).HasColumnName("FechaCierre");
            entity.Property(p => p.ObservacionesGenerales).HasColumnName("ObservacionesGenerales").HasColumnType("varchar(1000)");

            // Un paciente puede tener muchos planes cerrados (historial), pero solo
            // uno activo (FechaCierre NULL) a la vez — reforzado también en la BD
            // con un índice único filtrado (ver PeredentScript_Sprint2.sql).
            entity.HasIndex(p => p.IdPaciente)
                  .HasFilter("[FechaCierre] IS NULL")
                  .IsUnique();
        });

        modelBuilder.Entity<PlanTratamiento>(entity =>
        {
            entity.ToTable("PlanTratamiento");
            entity.HasKey(pt => pt.IdPlanTratamiento);
            entity.Property(pt => pt.IdPlanTratamiento).HasColumnName("ID_PlanTratamiento");
            entity.Property(pt => pt.IdPresupuestoPlan).HasColumnName("ID_PresupuestoPlan");
            entity.Property(pt => pt.IdEstadoTratamiento).HasColumnName("ID_EstadoTratamiento");
            entity.Property(pt => pt.Pieza).HasColumnName("Pieza").HasMaxLength(20).IsRequired();
            entity.Property(pt => pt.Tratamiento).HasColumnName("Tratamiento").HasMaxLength(255).IsRequired();
            entity.Property(pt => pt.Valor).HasColumnName("valor").HasColumnType("decimal(10,2)");
            entity.Property(pt => pt.FechaRegistroPlan).HasColumnName("FechaRegistroPlan");
            entity.Property(pt => pt.FechaFinTratamiento).HasColumnName("FechaFinTratamiento");

            entity.HasIndex(pt => new { pt.IdPresupuestoPlan, pt.Pieza }).IsUnique();

            entity.HasOne(pt => pt.EstadoTratamiento)
                  .WithMany()
                  .HasForeignKey(pt => pt.IdEstadoTratamiento);
        });

        modelBuilder.Entity<PresupuestoPlan>()
            .HasMany(p => p.Piezas)
            .WithOne()
            .HasForeignKey(pt => pt.IdPresupuestoPlan);

        modelBuilder.Entity<EstadoCita>(entity =>
        {
            entity.ToTable("EstadoCita");
            entity.HasKey(e => e.IdEstadoCita);
            entity.Property(e => e.IdEstadoCita).HasColumnName("ID_EstadoCita");
            entity.Property(e => e.TipoEstadoCita).HasColumnName("TipoEstadoCita").HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<Cita>(entity =>
        {
            entity.ToTable("Citas");
            entity.HasKey(c => c.IdCita);
            entity.Property(c => c.IdCita).HasColumnName("ID_Cita");
            entity.Property(c => c.IdUsuario).HasColumnName("ID_Usuario");
            entity.Property(c => c.IdPaciente).HasColumnName("ID_Paciente");
            entity.Property(c => c.IdEstadoCita).HasColumnName("ID_EstadoCita");
            entity.Property(c => c.FechaInicio).HasColumnName("Fecha_Inicio");
            entity.Property(c => c.FechaFin).HasColumnName("Fecha_Fin");
            entity.Property(c => c.NotasAdicionales).HasColumnName("NotasAdicionales").HasMaxLength(500);

            entity.HasOne(c => c.Usuario)
                  .WithMany()
                  .HasForeignKey(c => c.IdUsuario);

            entity.HasOne(c => c.Paciente)
                  .WithMany()
                  .HasForeignKey(c => c.IdPaciente);

            entity.HasOne(c => c.EstadoCita)
                  .WithMany()
                  .HasForeignKey(c => c.IdEstadoCita);
        });

        modelBuilder.Entity<BloqueoAgenda>(entity =>
        {
            entity.ToTable("BloqueoAgenda");
            entity.HasKey(b => b.IdBloqueoAgenda);
            entity.Property(b => b.IdBloqueoAgenda).HasColumnName("ID_BloqueoAgenda");
            entity.Property(b => b.IdUsuario).HasColumnName("ID_Usuario");
            entity.Property(b => b.Fecha).HasColumnName("Fecha");
            entity.Property(b => b.Motivo).HasColumnName("Motivo").HasMaxLength(200);
            entity.Property(b => b.CreadoEn).HasColumnName("CreadoEn");

            entity.HasOne(b => b.Usuario)
                  .WithMany()
                  .HasForeignKey(b => b.IdUsuario);

            entity.HasIndex(b => new { b.IdUsuario, b.Fecha }).IsUnique();
        });

        modelBuilder.Entity<Endodoncia>(entity =>
        {
            entity.ToTable("Endodoncia");
            entity.HasKey(e => e.IdEndodoncia);
            entity.Property(e => e.IdEndodoncia)
                .HasColumnName("ID_Endodoncia");
            entity.Property(e => e.IdPaciente)
                .HasColumnName("ID_Paciente");
            entity.Property(e => e.Pieza)
                .HasColumnName("Pieza")
                .HasMaxLength(10)
                .IsRequired();
            entity.Property(e => e.Mm1)
                .HasColumnName("MM1");
            entity.Property(e => e.Mm2)
                .HasColumnName("MM2");
            entity.Property(e => e.Mm3)
                .HasColumnName("MM3");
            entity.Property(e => e.Mm4)
                .HasColumnName("MM4");
            entity.Property(e => e.Diametro)
                .HasColumnName("Diametro");
            entity.Property(e => e.Cuspide)
                .HasColumnName("Cuspide")
                .HasMaxLength(50);
            entity.Property(e => e.Obturacion)
                .HasColumnName("Obturacion");
            entity.Property(e => e.TxPeriodontal)
                .HasColumnName("TxPeriodontal");
            entity.Property(e => e.ObservacionesTxPeriodontal)
                .HasColumnName("ObservacionesTxPeriodontal")
                .HasMaxLength(500);
            entity.Property(e => e.ObservacionesEndodoncia)
                .HasColumnName("ObservacionesEndodoncia")
                .HasMaxLength(500);
        });

        modelBuilder.Entity<Protesis>(entity =>
        {
            entity.ToTable("Protesis");
            entity.HasKey(p => p.IdProtesis);
            entity.Property(p => p.IdProtesis).HasColumnName("ID_Protesis");
            entity.Property(p => p.IdPaciente).HasColumnName("ID_Paciente");
            entity.Property(p => p.PPF).HasColumnName("PPF");
            entity.Property(p => p.PPRSup).HasColumnName("PPRSup");
            entity.Property(p => p.PPRInf).HasColumnName("PPRInf");
            entity.Property(p => p.PTSup).HasColumnName("PT_Sup");
            entity.Property(p => p.PTInf).HasColumnName("PT_Inf");
            entity.Property(p => p.ObservacionesProtesis)
                .HasColumnName("ObservacionesProtesis")
                .HasMaxLength(500);
        });

        modelBuilder.Entity<DatosRecetario>(entity =>
        {
            entity.ToTable("DatosRecetario");
            entity.HasKey(d => d.IdDatosRecetario);
            entity.Property(d => d.IdDatosRecetario).HasColumnName("ID_DatosRecetario");
            entity.Property(d => d.IdUsuario).HasColumnName("ID_Usuario");
            entity.Property(d => d.NombresOdontologo).HasColumnName("NombresOdontologo").HasMaxLength(100).IsRequired();
            entity.Property(d => d.ApellidosOdontologo).HasColumnName("ApellidosOdontologo").HasMaxLength(100).IsRequired();
            entity.Property(d => d.ColegiadoOdontologo).HasColumnName("ColegiadoOdontologo").HasMaxLength(50).IsRequired();
            entity.Property(d => d.DireccionOdontologo).HasColumnName("DireccionOdontologo").HasMaxLength(200).IsRequired();
            entity.Property(d => d.TelefonoOdontologo).HasColumnName("TelefonoOdontologo").HasMaxLength(20).IsRequired();
            entity.Property(d => d.CorreoOdontologo).HasColumnName("CorreoOdontologo").HasMaxLength(150).IsRequired();
            entity.Property(d => d.FirmaKeyR2).HasColumnName("Firma_KeyR2").HasMaxLength(500);
        });

        modelBuilder.Entity<Recetario>(entity =>
        {
            entity.ToTable("Recetario");
            entity.HasKey(r => r.IdRecetario);
            entity.Property(r => r.IdRecetario).HasColumnName("ID_Recetario");
            entity.Property(r => r.IdPaciente).HasColumnName("ID_Paciente");
            entity.Property(r => r.IdDatosRecetario).HasColumnName("ID_DatosRecetario");
            entity.Property(r => r.FechaEmisionRecetario).HasColumnName("FechaEmisionRecetario");
            entity.Property(r => r.NotasAdicionalesRecetario).HasColumnName("NotasAdicionalesRecetario").HasMaxLength(500);

            entity.HasOne(r => r.Paciente)
                  .WithMany()
                  .HasForeignKey(r => r.IdPaciente);

            entity.HasOne(r => r.DatosRecetario)
                  .WithMany()
                  .HasForeignKey(r => r.IdDatosRecetario);
        });

        modelBuilder.Entity<MedicamentoReceta>(entity =>
        {
            entity.ToTable("MedicamentosReceta");
            entity.HasKey(m => m.IdMedicamentosReceta);
            entity.Property(m => m.IdMedicamentosReceta).HasColumnName("ID_MedicamentosReceta");
            entity.Property(m => m.IdRecetario).HasColumnName("ID_Recetario");
            entity.Property(m => m.Nombre).HasColumnName("MedicamentoReceta").HasMaxLength(150).IsRequired();
            entity.Property(m => m.PresentacionReceta).HasColumnName("PresentacionReceta").HasMaxLength(100).IsRequired();
            entity.Property(m => m.IndicacionesReceta).HasColumnName("IndicacionesReceta").HasMaxLength(300).IsRequired();
        });

        modelBuilder.Entity<Recetario>()
            .HasMany(r => r.Medicamentos)
            .WithOne()
            .HasForeignKey(m => m.IdRecetario)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Panoramica>(entity =>
        {
            // Tabla ya definida en backend/src/db/PeredentScript_Sprint3.sql: se
            // replican tipos y default exactos (VARCHAR/DATETIME, no los nvarchar(max)
            // /datetime2 que EF usaría por convención) para que la migración generada
            // coincida con ese script.
            entity.ToTable("Panoramicas");
            entity.HasKey(p => p.IdPanoramica);
            entity.Property(p => p.IdPanoramica).HasColumnName("ID_Panoramica");
            entity.Property(p => p.IdPaciente).HasColumnName("ID_Paciente");
            entity.Property(p => p.KeyPanoramicaR2).HasColumnName("Key_PanoramicaR2").HasColumnType("varchar(500)").IsRequired();
            entity.Property(p => p.FechaSubida).HasColumnName("Fecha_Subida").HasColumnType("datetime").HasDefaultValueSql("GETDATE()").IsRequired();
            entity.Property(p => p.FechaEliminacion).HasColumnName("Fecha_Eliminacion").HasColumnType("datetime");

            // El script no declara ON DELETE CASCADE en esta FK (default NO ACTION);
            // sin este OnDelete, EF Core generaría CASCADE por ser una relación requerida.
            entity.HasOne(p => p.Paciente)
                  .WithMany()
                  .HasForeignKey(p => p.IdPaciente)
                  .HasConstraintName("FK_Panoramicas_Paciente")
                  .OnDelete(DeleteBehavior.NoAction);

            // Soft-delete: se filtra por Fecha_Eliminacion IS NULL para "activas", por
            // eso el índice compuesto (cubre también las búsquedas por sola ID_Paciente).
            entity.HasIndex(p => new { p.IdPaciente, p.FechaEliminacion })
                  .HasDatabaseName("IX_Panoramicas_Paciente_Activas");
        });
    }
}
