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
--   5. Catálogo MetodoPago (SCRUM-291, SCRUM-292)
--   6. Columna ID_MetodoPago en AbonoPaciente (SCRUM-293)
--   7. Segundo teléfono del paciente (Telefono_Secundario) y limpieza de
--      los teléfonos capturados como "42246235\ 34401287"
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
-- 5. Nueva tabla catálogo: MetodoPago (SCRUM-291, SCRUM-292)
-- -------------------------------------------------------------------------
-- Forma en que el paciente realizó un pago o abono.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MetodoPago')
BEGIN
    CREATE TABLE dbo.MetodoPago (
        ID_MetodoPago       INT IDENTITY(1,1) NOT NULL,
        NombreMetodoPago    VARCHAR(50) NOT NULL,

        CONSTRAINT PK_MetodoPago PRIMARY KEY (ID_MetodoPago),
        CONSTRAINT UQ_MetodoPago_NombreMetodoPago UNIQUE (NombreMetodoPago)
    );
END
GO

-- Carga inicial (solo si no existen)
IF NOT EXISTS (SELECT 1 FROM dbo.MetodoPago WHERE NombreMetodoPago = 'Efectivo')
    INSERT INTO dbo.MetodoPago (NombreMetodoPago) VALUES ('Efectivo');

IF NOT EXISTS (SELECT 1 FROM dbo.MetodoPago WHERE NombreMetodoPago = 'Transferencia')
    INSERT INTO dbo.MetodoPago (NombreMetodoPago) VALUES ('Transferencia');
GO

-- -------------------------------------------------------------------------
-- 6. Columna ID_MetodoPago en dbo.AbonoPaciente (SCRUM-293)
-- -------------------------------------------------------------------------
-- Es NOT NULL, pero ya hay abonos registrados sin método. Por eso se agrega
-- primero como NULL, los abonos existentes se marcan como "Efectivo" y
-- después se vuelve NOT NULL y se crea la llave foránea.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.AbonoPaciente') AND name = 'ID_MetodoPago'
)
    ALTER TABLE dbo.AbonoPaciente ADD ID_MetodoPago INT NULL;
GO

UPDATE dbo.AbonoPaciente
SET ID_MetodoPago = (SELECT ID_MetodoPago FROM dbo.MetodoPago WHERE NombreMetodoPago = 'Efectivo')
WHERE ID_MetodoPago IS NULL;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.AbonoPaciente') AND name = 'ID_MetodoPago' AND is_nullable = 1
)
    ALTER TABLE dbo.AbonoPaciente ALTER COLUMN ID_MetodoPago INT NOT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_AbonoPaciente_MetodoPago'
      AND parent_object_id = OBJECT_ID('dbo.AbonoPaciente')
)
    ALTER TABLE dbo.AbonoPaciente
    ADD CONSTRAINT FK_AbonoPaciente_MetodoPago FOREIGN KEY (ID_MetodoPago)
        REFERENCES dbo.MetodoPago(ID_MetodoPago);
GO

-- -------------------------------------------------------------------------
-- 7. Segundo teléfono del paciente: dbo.Paciente.Telefono_Secundario
-- -------------------------------------------------------------------------
-- Como solo había un campo, se capturaban dos números en Telefono
-- ("42246235\ 34401287", "54110066 59620061"). Ahora cada número va en su
-- columna y la app solo acepta 8 dígitos por teléfono.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Paciente') AND name = 'Telefono_Secundario'
)
    ALTER TABLE dbo.Paciente ADD Telefono_Secundario VARCHAR(20) NULL;
GO

-- Limpieza de Telefono: se quitan los separadores que se usaron. Si quedan
-- 8 dígitos se guarda limpio; si quedan 16 son dos números: el primero se
-- queda en Telefono y el segundo pasa a Telefono_Secundario.
;WITH Limpio AS (
    SELECT
        Telefono,
        Telefono_Secundario,
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            Telefono, ' ', ''), '\', ''), '/', ''), '-', ''), ',', ''), '.', ''), ';', ''), '|', ''), CHAR(9), '') AS Digitos
    FROM dbo.Paciente
)
UPDATE Limpio
SET Telefono = LEFT(Digitos, 8),
    Telefono_Secundario = CASE WHEN LEN(Digitos) = 16 THEN SUBSTRING(Digitos, 9, 8) ELSE Telefono_Secundario END
WHERE Digitos NOT LIKE '%[^0-9]%'
  AND (LEN(Digitos) = 8 OR (LEN(Digitos) = 16 AND Telefono_Secundario IS NULL))
  -- En una re-ejecución el teléfono ya está limpio (Telefono = Digitos) y se salta.
  AND Telefono <> Digitos;
GO

-- Mismo criterio para el teléfono del encargado (solo admite un número).
;WITH Limpio AS (
    SELECT
        Telefono_Encargado,
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            Telefono_Encargado, ' ', ''), '\', ''), '/', ''), '-', ''), ',', ''), '.', ''), ';', ''), '|', ''), CHAR(9), '') AS Digitos
    FROM dbo.Paciente
    WHERE Telefono_Encargado IS NOT NULL
)
UPDATE Limpio
SET Telefono_Encargado = Digitos
WHERE Digitos NOT LIKE '%[^0-9]%'
  AND LEN(Digitos) = 8
  AND Telefono_Encargado <> Digitos;
GO

-- Lo que no se pudo separar solo (letras, números de otra longitud, etc.) se
-- lista para corregirlo a mano desde "Editar paciente": la app ya no deja
-- guardar un teléfono que no tenga 8 dígitos.
SELECT ID_Paciente, Nombres, Apellidos, Telefono, Telefono_Secundario, Telefono_Encargado
FROM dbo.Paciente
WHERE Telefono NOT LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
   OR (Telefono_Encargado IS NOT NULL AND Telefono_Encargado <> ''
       AND Telefono_Encargado NOT LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]');
GO

-- -------------------------------------------------------------------------
-- Fin de cambios
-- -------------------------------------------------------------------------

COMMIT TRANSACTION;
