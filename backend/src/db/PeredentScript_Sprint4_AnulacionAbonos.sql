-- =========================================================================
-- Script de ampliación de base de datos - Sprint 4 (SCRUM-63)
-- Anulación de abonos (no se eliminan: quedan tachados en el estado de cuenta)
-- Sistema de agenda odontológica (PEREDENT)
-- =========================================================================
-- Un abono mal registrado no se borra: se ANULA con una bandera y sigue
-- visible en el historial, tachado, para conservar el rastro de que existió.
-- Solo un administrador puede anular. Se agregan a dbo.AbonoPaciente:
--   1. Anulado             (BIT, 0 por defecto: los abonos ya cargados siguen vigentes)
--   2. FechaAnulacion      (cuándo se anuló)
--   3. ID_UsuarioAnulacion (qué admin la anuló, FK a Usuario)
--   4. MotivoAnulacion     (texto libre opcional)
--
-- Se separa de PeredentScript_Sprint4.sql porque ese script ya se ejecutó en
-- las bases existentes. Es idempotente (IF NOT EXISTS), se puede re-ejecutar.
--
-- IMPORTANTE: hacer respaldo (backup) de la base de datos antes de ejecutar.
-- =========================================================================

BEGIN TRANSACTION;

-- -------------------------------------------------------------------------
-- 1. Columnas nuevas en dbo.AbonoPaciente
-- -------------------------------------------------------------------------
-- Cada columna va en su propio lote (GO) para que el script se pueda re-ejecutar
-- aunque una ejecución anterior haya quedado a medias: si la columna ya existe,
-- ese lote no hace nada y el resto sigue.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.AbonoPaciente') AND name = 'Anulado'
)
BEGIN
    ALTER TABLE dbo.AbonoPaciente
    ADD Anulado BIT NOT NULL CONSTRAINT DF_AbonoPaciente_Anulado DEFAULT (0);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.AbonoPaciente') AND name = 'FechaAnulacion'
)
BEGIN
    ALTER TABLE dbo.AbonoPaciente
    ADD FechaAnulacion DATETIME NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.AbonoPaciente') AND name = 'ID_UsuarioAnulacion'
)
BEGIN
    ALTER TABLE dbo.AbonoPaciente
    ADD ID_UsuarioAnulacion INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.AbonoPaciente') AND name = 'MotivoAnulacion'
)
BEGIN
    ALTER TABLE dbo.AbonoPaciente
    ADD MotivoAnulacion VARCHAR(300) NULL;
END
GO

-- -------------------------------------------------------------------------
-- 2. FK del admin que anuló
-- -------------------------------------------------------------------------
-- Va en un lote aparte porque SQL Server no deja referenciar en el mismo lote
-- una columna que se acaba de agregar.

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_AbonoPaciente_UsuarioAnulacion'
      AND parent_object_id = OBJECT_ID('dbo.AbonoPaciente')
)
BEGIN
    ALTER TABLE dbo.AbonoPaciente
    ADD CONSTRAINT FK_AbonoPaciente_UsuarioAnulacion FOREIGN KEY (ID_UsuarioAnulacion)
        REFERENCES dbo.Usuario(ID_Usuario);
END
GO

-- -------------------------------------------------------------------------
-- Fin de cambios
-- -------------------------------------------------------------------------

COMMIT TRANSACTION;
