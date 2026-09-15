-- ============================================================
-- Script: Tablas de Recetario y Panoramicas
-- Motor: SQL Server 2022
-- Proyecto: Royal Devs - PEREDENT
-- ============================================================

-- ============================================================
-- 1. DATOS RECETARIO (datos "quemados" del odontólogo)
-- ============================================================
CREATE TABLE DatosRecetario (
    ID_DatosRecetario      INT IDENTITY(1,1)  NOT NULL,
    ID_Usuario             INT                NOT NULL,
    NombresOdontologo      VARCHAR(100)       NOT NULL,
    ApellidosOdontologo    VARCHAR(100)       NOT NULL,
    ColegiadoOdontologo    VARCHAR(50)        NOT NULL,
    DireccionOdontologo    VARCHAR(200)       NOT NULL,
    TelefonoOdontologo     VARCHAR(20)        NOT NULL,
    CorreoOdontologo       VARCHAR(150)       NOT NULL,
    Firma_KeyR2            VARCHAR(500)       NULL,
    CONSTRAINT PK_DatosRecetario PRIMARY KEY (ID_DatosRecetario),
    CONSTRAINT FK_DatosRecetario_Usuario FOREIGN KEY (ID_Usuario)
        REFERENCES Usuario (ID_Usuario)
);
GO

-- ============================================================
-- 2. RECETARIO (cabecera de la receta médica)
-- ============================================================
CREATE TABLE Recetario (
    ID_Recetario            INT IDENTITY(1,1) NOT NULL,
    ID_Paciente             INT               NOT NULL,
    ID_DatosRecetario       INT               NOT NULL,
    FechaEmisionRecetario   DATETIME          NOT NULL DEFAULT GETDATE(),
    NotasAdicionales        VARCHAR(500)      NULL,
    CONSTRAINT PK_Recetario PRIMARY KEY (ID_Recetario),
    CONSTRAINT FK_Recetario_Paciente FOREIGN KEY (ID_Paciente)
        REFERENCES Paciente (ID_Paciente),
    CONSTRAINT FK_Recetario_DatosRecetario FOREIGN KEY (ID_DatosRecetario)
        REFERENCES DatosRecetario (ID_DatosRecetario)
);
GO

-- ============================================================
-- 3. MEDICAMENTOS RECETA (detalle: uno o varios por receta)
-- ============================================================
CREATE TABLE MedicamentosReceta (
    ID_MedicamentosReceta  INT IDENTITY(1,1) NOT NULL,
    ID_Recetario           INT               NOT NULL,
    MedicamentoReceta      VARCHAR(150)      NOT NULL,
    PresentacionReceta     VARCHAR(100)      NOT NULL,
    IndicacionesReceta     VARCHAR(300)      NOT NULL,
    CONSTRAINT PK_MedicamentosReceta PRIMARY KEY (ID_MedicamentosReceta),
    CONSTRAINT FK_MedicamentosReceta_Recetario FOREIGN KEY (ID_Recetario)
        REFERENCES Recetario (ID_Recetario)
        ON DELETE CASCADE
);
GO

-- ============================================================
-- 4. PANORAMICAS (fotos panorámicas del paciente en R2)
-- ============================================================
CREATE TABLE Panoramicas (
    ID_Panoramica       INT IDENTITY(1,1) NOT NULL,
    ID_Paciente         INT               NOT NULL,
    Key_PanoramicaR2    VARCHAR(500)      NOT NULL,
    Fecha_Subida        DATETIME          NOT NULL DEFAULT GETDATE(),
    Fecha_Eliminacion   DATETIME          NULL,
    CONSTRAINT PK_Panoramicas PRIMARY KEY (ID_Panoramica),
    CONSTRAINT FK_Panoramicas_Paciente FOREIGN KEY (ID_Paciente)
        REFERENCES Paciente (ID_Paciente)
);
GO

-- ============================================================
-- 5. ÍNDICES RECOMENDADOS
-- ============================================================

-- Búsqueda de recetas por paciente
CREATE INDEX IX_Recetario_Paciente ON Recetario (ID_Paciente);

-- Búsqueda de medicamentos por receta
CREATE INDEX IX_MedicamentosReceta_Recetario ON MedicamentosReceta (ID_Recetario);

-- Filtro de panorámicas activas por paciente (Fecha_Eliminacion IS NULL)
CREATE INDEX IX_Panoramicas_Paciente_Activas
    ON Panoramicas (ID_Paciente, Fecha_Eliminacion);
GO
