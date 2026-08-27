-- ============================================================
-- Royal Devs - Clinica Odontologica
-- Script de creacion de base de datos - Sprint -- Compatible con SQL Server 2022 (T-SQL)
-- ============================================================

IF DB_ID(N'Peredent') IS NULL
BEGIN
    CREATE DATABASE Peredent;
END
GO

USE Peredent;
GO

-- ---------- 1. Rol ----------
IF OBJECT_ID(N'dbo.Rol', N'U') IS NULL
BEGIN
    CREATE TABLE Rol (
        ID_Rol          INT IDENTITY(1,1) PRIMARY KEY,
        NombreRol       VARCHAR(50) NOT NULL UNIQUE
    );
END
GO

-- ---------- 2. Usuario ----------
IF OBJECT_ID(N'dbo.Usuario', N'U') IS NULL
BEGIN
    CREATE TABLE Usuario (
        ID_Usuario      INT IDENTITY(1,1) PRIMARY KEY,
        NombreUsuario   VARCHAR(50)  NOT NULL UNIQUE,
        Salt            VARCHAR(36)  NOT NULL,           -- valor aleatorio por usuario (ej. un NEWID())
        Contrasena_Hash VARCHAR(64)  NOT NULL,            -- SHA2_256(contrasena + salt) en hex = 64 caracteres
        ID_Rol          INT NOT NULL,
        Estado          BIT NOT NULL DEFAULT 1,          -- activo/inactivo
        UltimoAcceso    DATETIME NULL,
        CONSTRAINT FK_Usuario_Rol FOREIGN KEY (ID_Rol) REFERENCES Rol(ID_Rol)
    );
END
GO

-- ---------- 3. Paciente ----------
IF OBJECT_ID(N'dbo.Paciente', N'U') IS NULL
BEGIN
    CREATE TABLE Paciente (
        ID_Paciente         INT IDENTITY(1,1) PRIMARY KEY,
        Nombres             VARCHAR(100) NOT NULL,       -- obligatorio (SCRUM-15)
        Apellidos           VARCHAR(100) NOT NULL,       -- obligatorio (SCRUM-15)
        Sexo                VARCHAR(10)  NULL,
        Fecha_Nacimiento    DATE NOT NULL,                -- obligatorio, de aqui se calcula edad (SCRUM-13/15)
        Telefono            VARCHAR(20)  NOT NULL,        -- al menos un telefono (SCRUM-15)
        Correo              VARCHAR(100) NULL,
        Direccion           VARCHAR(200) NULL,
        Nombre_Encargado    VARCHAR(100) NULL,            -- obligatorio en app si es menor de edad (SCRUM-91)
        Telefono_Encargado  VARCHAR(20)  NULL,            -- obligatorio en app si es menor de edad (SCRUM-91)
        Fecha_Registro      DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- Indice para busqueda por nombre/apellido/telefono (SCRUM-21)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Paciente_Busqueda' AND object_id = OBJECT_ID(N'dbo.Paciente')
)
BEGIN
    CREATE INDEX IX_Paciente_Busqueda ON Paciente (Apellidos, Nombres, Telefono);
END
GO

-- ---------- 4. Historia_Medica ----------
-- Relacion 1 a 1 con Paciente: cada paciente tiene una sola historia que se va actualizando
IF OBJECT_ID(N'dbo.Historia_Medica', N'U') IS NULL
BEGIN
    CREATE TABLE Historia_Medica (
        ID_HistoriaMedica      INT IDENTITY(1,1) PRIMARY KEY,
        ID_Paciente             INT NOT NULL UNIQUE,
        Observaciones_Generales VARCHAR(500) NULL,        -- campo libre (SCRUM-19)
        CONSTRAINT FK_HistoriaMedica_Paciente FOREIGN KEY (ID_Paciente) REFERENCES Paciente(ID_Paciente)
    );
END
GO

-- ---------- 5. Condicion (catalogo) ----------
IF OBJECT_ID(N'dbo.Condicion', N'U') IS NULL
BEGIN
    CREATE TABLE Condicion (
        ID_Condicion      INT IDENTITY(1,1) PRIMARY KEY,
        Nombre_Condicion  VARCHAR(100) NOT NULL UNIQUE
    );
END
GO

-- ---------- 6. Historia_Condicion (puente) ----------
IF OBJECT_ID(N'dbo.Historia_Condicion', N'U') IS NULL
BEGIN
    CREATE TABLE Historia_Condicion (
        ID_HistoriaCondicion   INT IDENTITY(1,1) PRIMARY KEY,
        ID_HistoriaMedica       INT NOT NULL,
        ID_Condicion             INT NOT NULL,
        ObservacionCondicion    VARCHAR(300) NULL,        -- ej. "alergico a la penicilina" (SCRUM-18)
        CONSTRAINT FK_HistoriaCondicion_HistoriaMedica FOREIGN KEY (ID_HistoriaMedica) REFERENCES Historia_Medica(ID_HistoriaMedica),
        CONSTRAINT FK_HistoriaCondicion_Condicion FOREIGN KEY (ID_Condicion) REFERENCES Condicion(ID_Condicion),
        CONSTRAINT UQ_HistoriaCondicion UNIQUE (ID_HistoriaMedica, ID_Condicion)  -- evita marcar la misma condicion 2 veces
    );
END
GO

-- ============================================================
-- Datos para poder probar de inmediato
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM Rol)
BEGIN
    INSERT INTO Rol (NombreRol) VALUES
    ('Odontologo'), ('Asistente');
END
GO

IF NOT EXISTS (SELECT 1 FROM Condicion)
BEGIN
    INSERT INTO Condicion (Nombre_Condicion) VALUES
    ('Probelmas Cardiacos'), ('Enfermedades Renales'), ('Diabetes'), ('Hipertension'), ('Epilepsia'),
    ('Alergias'), ('Problemas hemorragicas'), ('Embarazo'), ('Medicacion'), ('Problemas con Tx dental');
END
GO

-- Usuario de prueba con contrasena hasheada con SHA2_256 + salt.
-- La contrasena de prueba es 'admin123'; en la app, el salt se genera una vez
-- por usuario (ej. NEWID()) y se guarda junto con el hash resultante.
IF NOT EXISTS (SELECT 1 FROM Usuario WHERE NombreUsuario = 'admin')
BEGIN
    DECLARE @salt VARCHAR(36) = CONVERT(VARCHAR(36), NEWID());
    DECLARE @hash VARCHAR(64) = CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'admin123' + @salt), 2);

    INSERT INTO Usuario (NombreUsuario, Salt, Contrasena_Hash, ID_Rol)
    VALUES ('admin', @salt, @hash, 1);
END
GO

-- Paciente de prueba (mayor de edad, sin encargado)
IF NOT EXISTS (SELECT 1 FROM Paciente)
BEGIN
    INSERT INTO Paciente (Nombres, Apellidos, Sexo, Fecha_Nacimiento, Telefono, Correo)
    VALUES ('Juan', 'Perez Lopez', 'M', '1995-04-12', '55551234', 'juan.perez@correo.com');
END
GO

-- Historia medica del paciente de prueba + una condicion marcada
IF NOT EXISTS (SELECT 1 FROM Historia_Medica)
BEGIN
    DECLARE @idPaciente INT = (SELECT ID_Paciente FROM Paciente WHERE Nombres = 'Juan' AND Apellidos = 'Perez Lopez');

    INSERT INTO Historia_Medica (ID_Paciente, Observaciones_Generales)
    VALUES (@idPaciente, 'Sin observaciones adicionales.');

    INSERT INTO Historia_Condicion (ID_HistoriaMedica, ID_Condicion, ObservacionCondicion)
    VALUES (SCOPE_IDENTITY(), 3, 'Alergico a la penicilina');
END
GO
D_HistoriaMedica, ID_Condicion, ObservacionCondicion)
VALUES (1, 3, 'Alergico a la penicilina');
