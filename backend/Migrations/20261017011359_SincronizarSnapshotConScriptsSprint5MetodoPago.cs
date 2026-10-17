using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Peredent.Api.Migrations
{
    /// <summary>
    /// Migración de sincronización: Up() y Down() están vacíos a propósito.
    /// Su único fin es poner al día el ModelSnapshot con objetos que ya se
    /// crearon en la base con PeredentScript_Sprint5.sql (backend/src/db/,
    /// secciones 5 a 7, SCRUM-291 a 293):
    ///   - Tabla MetodoPago.
    ///   - Columna AbonoPaciente.ID_MetodoPago, con su FK FK_AbonoPaciente_MetodoPago.
    ///   - Columna Paciente.Telefono_Secundario.
    /// Sin esta migración, la siguiente que se generara intentaría volver a
    /// crearlos y fallaría al aplicarse. Aplicarla solo registra la fila en
    /// __EFMigrationsHistory; no ejecuta nada sobre el esquema.
    /// </summary>
    public partial class SincronizarSnapshotConScriptsSprint5MetodoPago : Migration
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
