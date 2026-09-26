-- =========================================================================
-- Script de ampliación de base de datos - Sprint 4
-- Sistema de agenda odontológica (PEREDENT)
-- =========================================================================
-- Este script agrega los campos y tablas necesarios para:
--   1. NIT en Paciente (con valor por defecto "CF")
--   1b. Observaciones generales del plan de tratamiento (PresupuestoPlan)
--   2. Correo del usuario (para recuperación de contraseña)
--   3. Tabla ResetPassword (control de tokens de recuperación)
--   4. Tabla AbonoPaciente (registro de abonos/pagos por presupuesto)
--
-- IMPORTANTE: hacer respaldo (backup) de la base de datos antes de ejecutar.
-- =========================================================================

BEGIN TRANSACTION;

-- -------------------------------------------------------------------------
-- 1. Agregar campo NIT a la tabla Paciente
-- -------------------------------------------------------------------------
-- Se agrega como nullable y con valor por defecto 'CF'.
-- Los pacientes ya existentes quedarán con 'CF' automáticamente.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Paciente') AND name = 'NIT'
)
BEGIN
    ALTER TABLE dbo.Paciente
    ADD NIT VARCHAR(15) NOT NULL CONSTRAINT DF_Paciente_NIT DEFAULT ('CF');
END
GO

-- -------------------------------------------------------------------------
-- 1b. Agregar campo ObservacionesGenerales a la tabla PresupuestoPlan
-- -------------------------------------------------------------------------
-- Notas libres sobre el plan de tratamiento completo (no por pieza), por eso
-- va en PresupuestoPlan y no en PlanTratamiento. Opcional (nullable).

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.PresupuestoPlan') AND name = 'ObservacionesGenerales'
)
BEGIN
    ALTER TABLE dbo.PresupuestoPlan
    ADD ObservacionesGenerales VARCHAR(1000) NULL;
END
GO

-- -------------------------------------------------------------------------
-- 2. Agregar campo CorreoUsuario a la tabla Usuario
-- -------------------------------------------------------------------------
-- Necesario para poder enviar el enlace de recuperación de contraseña.
-- Se agrega nullable inicialmente porque pueden existir usuarios sin correo
-- registrado; una vez completada la información se puede migrar a NOT NULL.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Usuario') AND name = 'CorreoUsuario'
)
BEGIN
    ALTER TABLE dbo.Usuario
    ADD CorreoUsuario VARCHAR(150) NULL;
END
GO

-- Índice único para evitar correos duplicados entre usuarios
-- (se filtra NULL para no bloquear registros aún sin correo).
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_Usuario_CorreoUsuario' AND object_id = OBJECT_ID('dbo.Usuario')
)
BEGIN
    CREATE UNIQUE INDEX UQ_Usuario_CorreoUsuario
    ON dbo.Usuario(CorreoUsuario)
    WHERE CorreoUsuario IS NOT NULL;
END
GO

-- -------------------------------------------------------------------------
-- 3. Nueva tabla: ResetPassword
-- -------------------------------------------------------------------------
-- Controla los tokens de recuperación de contraseña: a quién pertenece,
-- cuál es el código, cuándo expira y si ya fue usado.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ResetPassword')
BEGIN
    CREATE TABLE dbo.ResetPassword (
        ID_TokenPassword    INT IDENTITY(1,1) NOT NULL,
        ID_Usuario          INT NOT NULL,
        TokenRestablecer    VARCHAR(255) NOT NULL,
        FechaExpiracion     DATETIME NOT NULL,
        TokenUsado          BIT NOT NULL CONSTRAINT DF_ResetPassword_TokenUsado DEFAULT (0),
        FechaCreacion       DATETIME NOT NULL CONSTRAINT DF_ResetPassword_FechaCreacion DEFAULT (GETDATE()),

        CONSTRAINT PK_ResetPassword PRIMARY KEY (ID_TokenPassword),
        CONSTRAINT FK_ResetPassword_Usuario FOREIGN KEY (ID_Usuario)
            REFERENCES dbo.Usuario(ID_Usuario)
    );

    -- El token debe ser único para poder buscarlo de forma confiable
    CREATE UNIQUE INDEX UQ_ResetPassword_Token
        ON dbo.ResetPassword(TokenRestablecer);
END
GO

-- -------------------------------------------------------------------------
-- 4. Nueva tabla: AbonoPaciente (registro de abonos)
-- -------------------------------------------------------------------------
-- Guarda cada abono/pago realizado contra un presupuesto de tratamiento,
-- incluyendo qué usuario (personal administrativo) lo registró.
-- El saldo pendiente se calcula (no se almacena) como:
--   (SUM(PlanTratamiento.valor de ese presupuesto) - PresupuestoPlan.CantidadDescuento)
--   - SUM(AbonoPaciente.MontoAbono de ese presupuesto)

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AbonoPaciente')
BEGIN
    CREATE TABLE dbo.AbonoPaciente (
        ID_AbonoPaciente    INT IDENTITY(1,1) NOT NULL,
        ID_PresupuestoPlan  INT NOT NULL,
        ID_Usuario          INT NOT NULL,
        MontoAbono          DECIMAL(10,2) NOT NULL,
        FechaAbono          DATETIME NOT NULL CONSTRAINT DF_AbonoPaciente_FechaAbono DEFAULT (GETDATE()),

        CONSTRAINT PK_AbonoPaciente PRIMARY KEY (ID_AbonoPaciente),
        CONSTRAINT FK_AbonoPaciente_PresupuestoPlan FOREIGN KEY (ID_PresupuestoPlan)
            REFERENCES dbo.PresupuestoPlan(ID_PresupuestoPlan),
        CONSTRAINT FK_AbonoPaciente_Usuario FOREIGN KEY (ID_Usuario)
            REFERENCES dbo.Usuario(ID_Usuario),
        CONSTRAINT CK_AbonoPaciente_MontoPositivo CHECK (MontoAbono > 0)
    );
END
GO

-- -------------------------------------------------------------------------
-- Fin de cambios
-- -------------------------------------------------------------------------

COMMIT TRANSACTION;