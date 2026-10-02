-- =========================================================================
-- Script de ampliación de base de datos - Sprint 4 (SCRUM-254)
-- Sistema de agenda odontológica (PEREDENT)
-- =========================================================================
-- Consentimiento informado de exodoncia quirúrgica de terceros molares:
--   1. Tabla ConsentimientoExodoncia (datos llenados del formato, por paciente)
--   2. Tabla ConsentimientoImpresion (registro de cada impresión: quién y cuándo)
--
-- Se separa de PeredentScript_Sprint4.sql porque ese script ya se ejecutó en
-- las bases existentes. Es idempotente (IF NOT EXISTS), se puede re-ejecutar.
--
-- IMPORTANTE: hacer respaldo (backup) de la base de datos antes de ejecutar.
-- =========================================================================

BEGIN TRANSACTION;

-- -------------------------------------------------------------------------
-- 1. Nueva tabla: ConsentimientoExodoncia
-- -------------------------------------------------------------------------
-- Solo guarda los campos editables del formato; el texto fijo (descripción del
-- procedimiento y lista de complicaciones) vive en el generador del PDF.
-- Estado: 'Borrador' al guardar/editar, 'Impreso' después de imprimir.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ConsentimientoExodoncia')
BEGIN
    CREATE TABLE dbo.ConsentimientoExodoncia (
        ID_Consentimiento       INT IDENTITY(1,1) NOT NULL,
        ID_Paciente             INT NOT NULL,
        ID_Usuario              INT NOT NULL,
        NombrePaciente          VARCHAR(200) NOT NULL,
        DocumentoPaciente       VARCHAR(30) NOT NULL,
        NombreRepresentante     VARCHAR(200) NULL,
        NombreDoctor            VARCHAR(200) NOT NULL,
        ColegiadoDoctor         VARCHAR(50) NULL,
        Procedimiento           VARCHAR(300) NOT NULL,
        RiesgosEspecificos      VARCHAR(1000) NULL,
        Observaciones           VARCHAR(1000) NULL,
        Lugar                   VARCHAR(100) NULL,
        FechaConsentimiento     DATE NOT NULL,
        Estado                  VARCHAR(20) NOT NULL CONSTRAINT DF_ConsentimientoExodoncia_Estado DEFAULT ('Borrador'),
        FechaCreacion           DATETIME NOT NULL CONSTRAINT DF_ConsentimientoExodoncia_FechaCreacion DEFAULT (GETDATE()),
        FechaModificacion       DATETIME NULL,

        CONSTRAINT PK_ConsentimientoExodoncia PRIMARY KEY (ID_Consentimiento),
        CONSTRAINT FK_ConsentimientoExodoncia_Paciente FOREIGN KEY (ID_Paciente)
            REFERENCES dbo.Paciente(ID_Paciente),
        CONSTRAINT FK_ConsentimientoExodoncia_Usuario FOREIGN KEY (ID_Usuario)
            REFERENCES dbo.Usuario(ID_Usuario),
        CONSTRAINT CK_ConsentimientoExodoncia_Estado CHECK (Estado IN ('Borrador', 'Impreso'))
    );

    CREATE INDEX IX_ConsentimientoExodoncia_Paciente
        ON dbo.ConsentimientoExodoncia(ID_Paciente);
END
GO

-- -------------------------------------------------------------------------
-- 2. Nueva tabla: ConsentimientoImpresion
-- -------------------------------------------------------------------------
-- Una fila por cada vez que se imprime (o reimprime tras una corrección).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ConsentimientoImpresion')
BEGIN
    CREATE TABLE dbo.ConsentimientoImpresion (
        ID_ConsentimientoImpresion  INT IDENTITY(1,1) NOT NULL,
        ID_Consentimiento           INT NOT NULL,
        ID_Usuario                  INT NOT NULL,
        FechaImpresion              DATETIME NOT NULL CONSTRAINT DF_ConsentimientoImpresion_Fecha DEFAULT (GETDATE()),

        CONSTRAINT PK_ConsentimientoImpresion PRIMARY KEY (ID_ConsentimientoImpresion),
        CONSTRAINT FK_ConsentimientoImpresion_Consentimiento FOREIGN KEY (ID_Consentimiento)
            REFERENCES dbo.ConsentimientoExodoncia(ID_Consentimiento),
        CONSTRAINT FK_ConsentimientoImpresion_Usuario FOREIGN KEY (ID_Usuario)
            REFERENCES dbo.Usuario(ID_Usuario)
    );

    CREATE INDEX IX_ConsentimientoImpresion_Consentimiento
        ON dbo.ConsentimientoImpresion(ID_Consentimiento);
END
GO

-- -------------------------------------------------------------------------
-- Fin de cambios
-- -------------------------------------------------------------------------

COMMIT TRANSACTION;
