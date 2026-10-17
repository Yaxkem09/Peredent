using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Peredent.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRespuestaPacienteWhatsApp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RespuestaMessageId",
                table: "Citas",
                type: "varchar(150)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RespuestaPaciente",
                table: "Citas",
                type: "varchar(20)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RespuestaPacienteEn",
                table: "Citas",
                type: "datetime",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RespuestaMessageId",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "RespuestaPaciente",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "RespuestaPacienteEn",
                table: "Citas");
        }
    }
}
