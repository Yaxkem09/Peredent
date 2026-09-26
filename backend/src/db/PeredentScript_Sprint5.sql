-- =========================================================================
-- Script de ampliación de base de datos - Sprint 5
-- Sistema de agenda odontológica (PEREDENT)
-- =========================================================================
-- Recordatorios de citas por WhatsApp:
--   1. Paciente.AceptaRecordatoriosWhatsApp  BIT NOT NULL DEFAULT 0
--      (consentimiento del paciente para recibir recordatorios).
--   2. Citas.RecordatorioEnviadoEn  DATETIME NULL      (hora de Guatemala)
--      Citas.RecordatorioMessageId  VARCHAR(150) NULL  ("wamid" de Meta)
--      Citas.RecordatorioError      VARCHAR(500) NULL
--
-- Estas columnas se gestionan con EF Core Migrations (backend/Migrations/):
--   - 20260926232455_SincronizarSnapshotConScriptsSprint2a4 (vacía: solo
--     registra en el historial lo que ya crearon los scripts Sprint 2 a 4)
--   - 20260926232546_AddRecordatoriosWhatsApp
--
-- La sección 2 es la salida de:
--   dotnet ef migrations script 0 AddRecordatoriosWhatsApp --idempotent
-- Es segura de ejecutar varias veces y sobre bases que ya tengan aplicada
-- cualquiera de las migraciones (revisa __EFMigrationsHistory antes de cada
-- paso). Pensada para la base de Somee, donde no se corre "dotnet ef".
-- Si se agregan migraciones nuevas, regenerar la sección 2 con el comando.
--
-- IMPORTANTE: hacer respaldo (backup) de la base de datos antes de ejecutar.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Reconciliación de Panoramicas (escrita a mano, idempotente)
-- -------------------------------------------------------------------------
-- PeredentScript_Sprint3.sql también trae un CREATE TABLE Panoramicas. Si la
-- tabla se creó con ese script, __EFMigrationsHistory no tiene la fila de
-- AddPanoramicas y la sección 2 intentaría crearla de nuevo (y fallaría toda
-- la transacción). Aquí se registra como ya aplicada en ese caso.
IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

IF OBJECT_ID(N'[Panoramicas]') IS NOT NULL
    AND NOT EXISTS (
        SELECT * FROM [__EFMigrationsHistory]
        WHERE [MigrationId] = N'20260919222558_AddPanoramicas'
    )
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260919222558_AddPanoramicas', N'9.0.0');
END;
GO

-- -------------------------------------------------------------------------
-- 2. Migraciones de EF Core (generado con --idempotent, no editar a mano)
-- -------------------------------------------------------------------------
IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260919222558_AddPanoramicas'
)
BEGIN
    CREATE TABLE [Panoramicas] (
        [ID_Panoramica] int NOT NULL IDENTITY,
        [ID_Paciente] int NOT NULL,
        [Key_PanoramicaR2] varchar(500) NOT NULL,
        [Fecha_Subida] datetime NOT NULL DEFAULT (GETDATE()),
        [Fecha_Eliminacion] datetime NULL,
        CONSTRAINT [PK_Panoramicas] PRIMARY KEY ([ID_Panoramica]),
        CONSTRAINT [FK_Panoramicas_Paciente] FOREIGN KEY ([ID_Paciente]) REFERENCES [Paciente] ([ID_Paciente])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260919222558_AddPanoramicas'
)
BEGIN
    CREATE INDEX [IX_Panoramicas_Paciente_Activas] ON [Panoramicas] ([ID_Paciente], [Fecha_Eliminacion]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260919222558_AddPanoramicas'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260919222558_AddPanoramicas', N'9.0.0');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260926232455_SincronizarSnapshotConScriptsSprint2a4'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260926232455_SincronizarSnapshotConScriptsSprint2a4', N'9.0.0');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260926232546_AddRecordatoriosWhatsApp'
)
BEGIN
    ALTER TABLE [Paciente] ADD [AceptaRecordatoriosWhatsApp] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260926232546_AddRecordatoriosWhatsApp'
)
BEGIN
    ALTER TABLE [Citas] ADD [RecordatorioEnviadoEn] datetime NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260926232546_AddRecordatoriosWhatsApp'
)
BEGIN
    ALTER TABLE [Citas] ADD [RecordatorioError] varchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260926232546_AddRecordatoriosWhatsApp'
)
BEGIN
    ALTER TABLE [Citas] ADD [RecordatorioMessageId] varchar(150) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260926232546_AddRecordatoriosWhatsApp'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260926232546_AddRecordatoriosWhatsApp', N'9.0.0');
END;

COMMIT;
GO

