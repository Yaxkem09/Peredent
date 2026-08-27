/* ============================================================
   PEREDENT - Script de creación de tablas
   Motor: SQL Server 2022
   Tablas ya existentes en la BD (NO se crean aquí):
     Paciente, Usuario, Rol, Historia_Medica, Historia_Condicion, Condicion
   Tablas que crea este script:
     1. EstadoCita
     2. EstadoTratamiento
     3. PresupuestoPlan
     4. PlanTratamiento
     5. Citas
     6. Endodoncia
     7. Protesis
   ============================================================ */

-- ============================================================
-- 1. EstadoCita  (catálogo: Pendiente, Confirmada, Atendida, Cancelada)
-- ============================================================
CREATE TABLE EstadoCita (
    ID_EstadoCita   INT IDENTITY(1,1) PRIMARY KEY,
    TipoEstadoCita  VARCHAR(50) NOT NULL
);
GO

-- ============================================================
-- 2. EstadoTratamiento  (catálogo: Pendiente, Completado)
-- ============================================================
CREATE TABLE EstadoTratamiento (
    ID_EstadoTratamiento INT IDENTITY(1,1) PRIMARY KEY,
    EstadoTratamiento    VARCHAR(50) NOT NULL
);
GO

-- ============================================================
-- 3. PresupuestoPlan  (agrupa varias piezas/tratamientos de un mismo presupuesto)
-- ============================================================
CREATE TABLE PresupuestoPlan (
    ID_PresupuestoPlan INT IDENTITY(1,1) PRIMARY KEY,
    ID_Paciente         INT NOT NULL,
    FechaPresupuesto    DATE NOT NULL,
    CantidadDescuento   DECIMAL(10,2) NULL,

    CONSTRAINT FK_PresupuestoPlan_Paciente
        FOREIGN KEY (ID_Paciente) REFERENCES Paciente(ID_Paciente)
);
GO

-- ============================================================
-- 4. PlanTratamiento  (una fila por cada pieza/tratamiento dentro de un presupuesto)
-- ============================================================
CREATE TABLE PlanTratamiento (
    ID_PlanTratamiento     INT IDENTITY(1,1) PRIMARY KEY,
    ID_PresupuestoPlan     INT NOT NULL,
    ID_EstadoTratamiento   INT NOT NULL,
    Pieza                  VARCHAR(20) NOT NULL,
    Tratamiento             VARCHAR(255) NOT NULL,
    valor                  DECIMAL(10,2) NOT NULL,
    FechaRegistroPlan      DATE NOT NULL,
    FechaFinTratamiento    DATE NULL,

    CONSTRAINT FK_PlanTratamiento_PresupuestoPlan
        FOREIGN KEY (ID_PresupuestoPlan) REFERENCES PresupuestoPlan(ID_PresupuestoPlan),
    CONSTRAINT FK_PlanTratamiento_EstadoTratamiento
        FOREIGN KEY (ID_EstadoTratamiento) REFERENCES EstadoTratamiento(ID_EstadoTratamiento)
);
GO

-- ============================================================
-- 5. Citas
-- ============================================================
CREATE TABLE Citas (
    ID_Cita          INT IDENTITY(1,1) PRIMARY KEY,
    ID_Usuario       INT NOT NULL,
    ID_Paciente      INT NOT NULL,
    ID_EstadoCita    INT NOT NULL,
    Fecha_Inicio     DATETIME NOT NULL,
    Fecha_Fin        DATETIME NOT NULL,
    NotasAdicionales VARCHAR(500) NULL,

    CONSTRAINT FK_Citas_Usuario
        FOREIGN KEY (ID_Usuario) REFERENCES Usuario(ID_Usuario),
    CONSTRAINT FK_Citas_Paciente
        FOREIGN KEY (ID_Paciente) REFERENCES Paciente(ID_Paciente),
    CONSTRAINT FK_Citas_EstadoCita
        FOREIGN KEY (ID_EstadoCita) REFERENCES EstadoCita(ID_EstadoCita)
);
GO

-- ============================================================
-- 6. Endodoncia  (registro clínico independiente del plan, por pieza)
-- ============================================================
CREATE TABLE Endodoncia (
    ID_Endodoncia               INT IDENTITY(1,1) PRIMARY KEY,
    ID_Paciente                 INT NOT NULL,
    Pieza                       VARCHAR(20) NOT NULL,
    MM1                         INT NULL,
    MM2                         INT NULL,
    MM3                         INT NULL,
    MM4                         INT NULL,
    Diametro                    INT NULL,
    Cuspide                     VARCHAR(50) NULL,
    Obturacion                  BIT NOT NULL DEFAULT 0,
    TxPeriodontal               BIT NOT NULL DEFAULT 0,
    ObservacionesTxPeriodontal  VARCHAR(500) NULL,
    ObservacionesEndodoncia     VARCHAR(500) NULL,

    CONSTRAINT FK_Endodoncia_Paciente
        FOREIGN KEY (ID_Paciente) REFERENCES Paciente(ID_Paciente)
);
GO

-- ============================================================
-- 7. Protesis  (un solo registro por paciente -> PK = FK, relación uno a uno)
-- ============================================================
CREATE TABLE Protesis (
    ID_Paciente            INT PRIMARY KEY,
    PPF                    BIT NOT NULL DEFAULT 0,
    PPR_sup                BIT NOT NULL DEFAULT 0,
    PPR_inf                BIT NOT NULL DEFAULT 0,
    PT_sup                 BIT NOT NULL DEFAULT 0,
    PT_inf                 BIT NOT NULL DEFAULT 0,
    ObservacionesProtesis  VARCHAR(500) NULL,

    CONSTRAINT FK_Protesis_Paciente
        FOREIGN KEY (ID_Paciente) REFERENCES Paciente(ID_Paciente)
);
GO

-- ============================================================
-- Datos de prueba
-- Asume el paciente (ID_Paciente = 1, Juan Perez Lopez) y el usuario
-- (ID_Usuario = 1, admin) insertados en el script del Sprint 1.
-- ============================================================

-- ---------- EstadoCita ----------
INSERT INTO EstadoCita (TipoEstadoCita) VALUES
('Pendiente'), ('Confirmada'), ('Atendida'), ('Cancelada');
GO

-- ---------- EstadoTratamiento ----------
INSERT INTO EstadoTratamiento (EstadoTratamiento) VALUES
('Pendiente'), ('Completado');
GO

-- ---------- PresupuestoPlan ----------
DECLARE @idPresupuesto INT;

INSERT INTO PresupuestoPlan (ID_Paciente, FechaPresupuesto, CantidadDescuento)
VALUES (1, GETDATE(), 0);

SET @idPresupuesto = SCOPE_IDENTITY();

-- ---------- PlanTratamiento ----------
DECLARE @idEstadoTxPendiente   INT = (SELECT ID_EstadoTratamiento FROM EstadoTratamiento WHERE EstadoTratamiento = 'Pendiente');
DECLARE @idEstadoTxCompletado  INT = (SELECT ID_EstadoTratamiento FROM EstadoTratamiento WHERE EstadoTratamiento = 'Completado');

INSERT INTO PlanTratamiento (ID_PresupuestoPlan, ID_EstadoTratamiento, Pieza, Tratamiento, valor, FechaRegistroPlan, FechaFinTratamiento)
VALUES
(@idPresupuesto, @idEstadoTxCompletado, '16', 'Resina compuesta', 800.00, '2026-08-01', '2026-08-01'),
(@idPresupuesto, @idEstadoTxPendiente,  '15', 'Endodoncia',       2500.00, '2026-08-10', NULL);
GO

-- ---------- Citas ----------
DECLARE @idEstadoCitaConfirmada INT = (SELECT ID_EstadoCita FROM EstadoCita WHERE TipoEstadoCita = 'Confirmada');
DECLARE @idEstadoCitaPendiente  INT = (SELECT ID_EstadoCita FROM EstadoCita WHERE TipoEstadoCita = 'Pendiente');

INSERT INTO Citas (ID_Usuario, ID_Paciente, ID_EstadoCita, Fecha_Inicio, Fecha_Fin, NotasAdicionales)
VALUES
(1, 1, @idEstadoCitaConfirmada, '2026-09-01 09:00', '2026-09-01 09:30', 'Revision de rutina'),
(1, 1, @idEstadoCitaPendiente,  '2026-09-05 10:00', '2026-09-05 10:45', NULL);
GO

-- ---------- Endodoncia ----------
INSERT INTO Endodoncia (ID_Paciente, Pieza, MM1, MM2, MM3, MM4, Diametro, Cuspide, Obturacion, TxPeriodontal, ObservacionesTxPeriodontal, ObservacionesEndodoncia)
VALUES (1, '46', 21, 20, 19, NULL, 25, 'Mesiovestibular', 1, 0, NULL, 'Conducto tratado sin complicaciones.');
GO

-- ---------- Protesis ----------
INSERT INTO Protesis (ID_Paciente, PPF, PPR_sup, PPR_inf, PT_sup, PT_inf, ObservacionesProtesis)
VALUES (1, 0, 1, 0, 0, 0, 'Protesis parcial removible superior en proceso de ajuste.');
GO
