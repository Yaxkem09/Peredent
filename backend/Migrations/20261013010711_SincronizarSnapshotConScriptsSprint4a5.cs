using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Peredent.Api.Migrations
{
    /// <summary>
    /// Migración de sincronización: Up() y Down() están vacíos a propósito.
    /// Su único fin es poner al día el ModelSnapshot con objetos que ya se
    /// crearon o corrigieron en la base con los scripts SQL (backend/src/db/):
    ///   - PeredentScript_Sprint4.sql: tablas AbonoPaciente y ResetPassword.
    ///   - PeredentScript_Sprint4_Consentimientos.sql: tablas
    ///     ConsentimientoExodoncia y ConsentimientoImpresion.
    ///   - PeredentScript_Sprint5.sql: tablas TipoConstanciaMedica,
    ///     ConstanciaMedica y EndodonciaPaciente, y quita de Endodoncia
    ///     TxPeriodontal, ObservacionesTxPeriodontal y ObservacionesEndodoncia.
    ///   - Protesis: la tabla de PeredentScript_Sprint2.sql siempre tuvo PK
    ///     ID_Paciente y columnas PPR_sup/PPR_inf/PT_sup/PT_inf; el modelo estaba
    ///     mal mapeado (ID_Protesis, PPRSup...) y SincronizarSnapshotConScriptsSprint2a4
    ///     copió ese error al snapshot. El modelo ya se corrigió; la base no cambia.
    /// Sin esta migración, la siguiente que se generara intentaría volver a
    /// crearlos (y renombrar columnas de Protesis) y fallaría al aplicarse.
    /// Aplicarla solo registra la fila en __EFMigrationsHistory; no ejecuta
    /// nada sobre el esquema.
    /// </summary>
    public partial class SincronizarSnapshotConScriptsSprint4a5 : Migration
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
