using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Peredent.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPanoramicas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Panoramicas",
                columns: table => new
                {
                    ID_Panoramica = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ID_Paciente = table.Column<int>(type: "int", nullable: false),
                    Key_PanoramicaR2 = table.Column<string>(type: "varchar(500)", nullable: false),
                    Fecha_Subida = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "GETDATE()"),
                    Fecha_Eliminacion = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Panoramicas", x => x.ID_Panoramica);
                    table.ForeignKey(
                        name: "FK_Panoramicas_Paciente",
                        column: x => x.ID_Paciente,
                        principalTable: "Paciente",
                        principalColumn: "ID_Paciente");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Panoramicas_Paciente_Activas",
                table: "Panoramicas",
                columns: new[] { "ID_Paciente", "Fecha_Eliminacion" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Panoramicas");
        }
    }
}
