/* ============================================================
   PEREDENT - Ajustes de esquema para el modulo de Agenda/Citas
   Motor: SQL Server 2022
   Se ejecuta despues de PeredentScript_Sprint2.sql (que ya crea
   las tablas Citas y EstadoCita). Este script solo agrega lo
   que falta de forma aditiva, sin tocar filas existentes:
    1. Estado adicional 'No Asistio' en EstadoCita
   ============================================================ */

USE Peredent;
GO

-- ---------- EstadoCita: agregar 'No Asistio' ----------
-- PeredentScript_Sprint2.sql ya siembra Pendiente, Confirmada, Atendida, Cancelada.
IF NOT EXISTS (SELECT 1 FROM EstadoCita WHERE TipoEstadoCita = 'No Asistio')
BEGIN
    INSERT INTO EstadoCita (TipoEstadoCita) VALUES ('No Asistio');
END
GO
