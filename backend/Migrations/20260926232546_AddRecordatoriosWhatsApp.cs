using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Peredent.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRecordatoriosWhatsApp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AceptaRecordatoriosWhatsApp",
                table: "Paciente",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "RecordatorioEnviadoEn",
                table: "Citas",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecordatorioError",
                table: "Citas",
                type: "varchar(500)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecordatorioMessageId",
                table: "Citas",
                type: "varchar(150)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AceptaRecordatoriosWhatsApp",
                table: "Paciente");

            migrationBuilder.DropColumn(
                name: "RecordatorioEnviadoEn",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "RecordatorioError",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "RecordatorioMessageId",
                table: "Citas");
        }
    }
}
