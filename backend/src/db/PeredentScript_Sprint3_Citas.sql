/* ============================================================
   PEREDENT - Ajustes de esquema para el modulo de Agenda/Citas
   Motor: SQL Server 2022
   Se ejecuta despues de PeredentScript_Sprint2.sql (que ya crea
   las tablas Citas y EstadoCita). Este script solo agrega lo
   que falta de forma aditiva, sin tocar filas existentes:
     1. Columna Citas.TipoTratamiento
     2. Columna Citas.EnviarRecordatorioWhatsApp
     3. Estado adicional 'No Asistio' en EstadoCita
   ============================================================ */

USE Peredent;
GO

-- ---------- 1. Citas.TipoTratamiento ----------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Citas') AND name = 'TipoTratamiento'
)
BEGIN
    ALTER TABLE Citas ADD TipoTratamiento VARCHAR(150) NOT NULL DEFAULT '';
END
GO

-- ---------- 2. Citas.EnviarRecordatorioWhatsApp ----------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Citas') AND name = 'EnviarRecordatorioWhatsApp'
)
BEGIN
    ALTER TABLE Citas ADD EnviarRecordatorioWhatsApp BIT NOT NULL DEFAULT 0;
END
GO

-- ---------- 3. EstadoCita: agregar 'No Asistio' ----------
-- PeredentScript_Sprint2.sql ya siembra Pendiente, Confirmada, Atendida, Cancelada.
IF NOT EXISTS (SELECT 1 FROM EstadoCita WHERE TipoEstadoCita = 'No Asistio')
BEGIN
    INSERT INTO EstadoCita (TipoEstadoCita) VALUES ('No Asistio');
END
GO
