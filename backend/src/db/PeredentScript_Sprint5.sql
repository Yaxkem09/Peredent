-- =========================================================================
-- Script de ampliación de base de datos - Sprint 5
-- Sistema de agenda odontológica (PEREDENT)
-- =========================================================================
-- Este script agrega las tablas necesarias para:
--   1. Catálogo TipoConstanciaMedica (SCRUM-298)
--   2. Tabla ConstanciaMedica (SCRUM-299)
--   3. Tabla EndodonciaPaciente (Tx periodontal y observaciones sin
--      depender de que haya piezas registradas)
--   4. Quitar de Endodoncia TxPeriodontal, ObservacionesTxPeriodontal y
--      ObservacionesEndodoncia (ya migradas a EndodonciaPaciente)
--
-- Es idempotente (IF NOT EXISTS), se puede re-ejecutar.
--
-- IMPORTANTE: hacer respaldo (backup) de la base de datos antes de ejecutar.
-- =========================================================================

BEGIN TRANSACTION;

-- -------------------------------------------------------------------------
-- 1. Nueva tabla catálogo: TipoConstanciaMedica (SCRUM-298)
-- -------------------------------------------------------------------------
-- Tipos de constancia que puede emitir el odontólogo. Cada tipo corresponde
-- a una plantilla fija en el generador del documento.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TipoConstanciaMedica')
BEGIN
    CREATE TABLE dbo.TipoConstanciaMedica (
        ID_TipoConstanciaMedica INT IDENTITY(1,1) NOT NULL,
        NombreConstancia        VARCHAR(100) NOT NULL,

        CONSTRAINT PK_TipoConstanciaMedica PRIMARY KEY (ID_TipoConstanciaMedica),
        CONSTRAINT UQ_TipoConstanciaMedica_NombreConstancia UNIQUE (NombreConstancia)
    );
END
GO

-- Carga inicial de los dos tipos (solo si no existen)
IF NOT EXISTS (SELECT 1 FROM dbo.TipoConstanciaMedica WHERE NombreConstancia = 'Extracción de terceras molares')
    INSERT INTO dbo.TipoConstanciaMedica (NombreConstancia) VALUES ('Extracción de terceras molares');

IF NOT EXISTS (SELECT 1 FROM dbo.TipoConstanciaMedica WHERE NombreConstancia = 'Tratamiento realizado')
    INSERT INTO dbo.TipoConstanciaMedica (NombreConstancia) VALUES ('Tratamiento realizado');
GO

-- -------------------------------------------------------------------------
-- 2. Nueva tabla: ConstanciaMedica (SCRUM-299)
-- -------------------------------------------------------------------------
-- Cada constancia emitida a un paciente. Solo se insertan registros: una
-- constancia emitida no se edita; si tiene un error se genera una nueva
-- (SCRUM-302).
--   - ID_Usuario: odontólogo que la emite. Su nombre, colegiado y teléfono
--     para el pie del documento se toman de DatosRecetario.
--   - TratamientoRealizadoConstancia: solo aplica al tipo "Tratamiento
--     realizado"; en "Extracción de terceras molares" queda NULL.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ConstanciaMedica')
BEGIN
    CREATE TABLE dbo.ConstanciaMedica (
        ID_ConstanciaMedica             INT IDENTITY(1,1) NOT NULL,
        ID_Paciente                     INT NOT NULL,
        ID_TipoConstanciaMedica         INT NOT NULL,
        ID_Usuario                      INT NOT NULL,
        FechaAtencionConstancia         DATE NOT NULL,
        DiasReposo                      INT NOT NULL,
        TratamientoRealizadoConstancia  VARCHAR(1000) NULL,
        LugarEmisionConstancia          VARCHAR(100) NULL,
        FechaEmisionConstancia          DATETIME NOT NULL CONSTRAINT DF_ConstanciaMedica_FechaEmision DEFAULT (GETDATE()),

        CONSTRAINT PK_ConstanciaMedica PRIMARY KEY (ID_ConstanciaMedica),
        CONSTRAINT FK_ConstanciaMedica_Paciente FOREIGN KEY (ID_Paciente)
            REFERENCES dbo.Paciente(ID_Paciente),
        CONSTRAINT FK_ConstanciaMedica_TipoConstanciaMedica FOREIGN KEY (ID_TipoConstanciaMedica)
            REFERENCES dbo.TipoConstanciaMedica(ID_TipoConstanciaMedica),
        CONSTRAINT FK_ConstanciaMedica_Usuario FOREIGN KEY (ID_Usuario)
            REFERENCES dbo.Usuario(ID_Usuario),
        CONSTRAINT CK_ConstanciaMedica_DiasReposo CHECK (DiasReposo >= 0)
    );

    -- Para listar rápido las constancias de un paciente (SCRUM-300)
    CREATE INDEX IX_ConstanciaMedica_Paciente
        ON dbo.ConstanciaMedica(ID_Paciente, FechaEmisionConstancia DESC);
END
GO

-- -------------------------------------------------------------------------
-- 3. Nueva tabla: EndodonciaPaciente (datos generales de endodoncia)
-- -------------------------------------------------------------------------
-- Tx periodontal y las observaciones son del paciente, no de una pieza. Antes
-- se repetían en cada fila de dbo.Endodoncia, así que sin piezas registradas
-- no se podían guardar. Ahora van en un registro por paciente (PK = FK).
-- Las columnas viejas de dbo.Endodoncia se borran en el paso 4.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EndodonciaPaciente')
BEGIN
    CREATE TABLE dbo.EndodonciaPaciente (
        ID_Paciente                 INT NOT NULL,
        TxPeriodontal               BIT NOT NULL CONSTRAINT DF_EndodonciaPaciente_TxPeriodontal DEFAULT (0),
        ObservacionesTxPeriodontal  VARCHAR(500) NULL,
        ObservacionesEndodoncia     VARCHAR(500) NULL,

        CONSTRAINT PK_EndodonciaPaciente PRIMARY KEY (ID_Paciente),
        CONSTRAINT FK_EndodonciaPaciente_Paciente FOREIGN KEY (ID_Paciente)
            REFERENCES dbo.Paciente(ID_Paciente)
    );
END
GO

-- Migra lo ya registrado: toma los datos generales de la primera pieza de
-- cada paciente (eran iguales en todas sus filas). Va con SQL dinámico y solo
-- si las columnas viejas todavía existen: en una re-ejecución ya se borraron
-- (paso 4) y el lote no compilaría.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Endodoncia') AND name = 'TxPeriodontal'
)
BEGIN
    EXEC sp_executesql N'
        INSERT INTO dbo.EndodonciaPaciente (ID_Paciente, TxPeriodontal, ObservacionesTxPeriodontal, ObservacionesEndodoncia)
        SELECT e.ID_Paciente, e.TxPeriodontal, e.ObservacionesTxPeriodontal, e.ObservacionesEndodoncia
        FROM dbo.Endodoncia e
        WHERE e.ID_Endodoncia IN (SELECT MIN(ID_Endodoncia) FROM dbo.Endodoncia GROUP BY ID_Paciente)
          AND NOT EXISTS (SELECT 1 FROM dbo.EndodonciaPaciente ep WHERE ep.ID_Paciente = e.ID_Paciente);';
END
GO

-- -------------------------------------------------------------------------
-- 4. Quitar de dbo.Endodoncia las columnas que pasaron a EndodonciaPaciente
-- -------------------------------------------------------------------------
-- Ya migradas en el paso 3. TxPeriodontal tiene un DEFAULT con nombre
-- generado por SQL Server (se creó sin nombre en el Sprint 2), así que se
-- busca y se elimina antes de borrar la columna.

DECLARE @defaultTx SYSNAME = (
    SELECT dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Endodoncia') AND c.name = 'TxPeriodontal'
);
IF @defaultTx IS NOT NULL
    EXEC (N'ALTER TABLE dbo.Endodoncia DROP CONSTRAINT ' + @defaultTx);
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Endodoncia') AND name = 'TxPeriodontal'
)
    ALTER TABLE dbo.Endodoncia DROP COLUMN TxPeriodontal;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Endodoncia') AND name = 'ObservacionesTxPeriodontal'
)
    ALTER TABLE dbo.Endodoncia DROP COLUMN ObservacionesTxPeriodontal;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Endodoncia') AND name = 'ObservacionesEndodoncia'
)
    ALTER TABLE dbo.Endodoncia DROP COLUMN ObservacionesEndodoncia;
GO

-- -------------------------------------------------------------------------
-- Fin de cambios
-- -------------------------------------------------------------------------

COMMIT TRANSACTION;
