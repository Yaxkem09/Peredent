using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Peredent.Api.Migrations
{
    /// <summary>
    /// Migración de sincronización: Up() y Down() están vacíos a propósito.
    /// Su único fin es poner al día el ModelSnapshot con objetos que ya se
    /// crearon en la base con los scripts SQL de los Sprints 2 a 4
    /// (backend/src/db/):
    ///   - Sprint 2: tabla Protesis.
    ///   - Sprint 3: tablas DatosRecetario, Recetario y MedicamentosReceta.
    ///   - Sprint 4: columnas Paciente.NIT, PresupuestoPlan.ObservacionesGenerales
    ///     y Usuario.CorreoUsuario.
    /// Sin esta migración, la siguiente que se generara intentaría volver a
    /// crearlos y fallaría al aplicarse. Aplicarla solo registra la fila en
    /// __EFMigrationsHistory; no ejecuta nada sobre el esquema.
    /// </summary>
    public partial class SincronizarSnapshotConScriptsSprint2a4 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
