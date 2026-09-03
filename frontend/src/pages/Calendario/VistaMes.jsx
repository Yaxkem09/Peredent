import { useEffect, useState } from 'react';
import { Button } from '../../components/common';
import {
  DIAS_SEMANA_CORTO,
  addDays,
  mondayOf,
  toIsoDate,
  hoy,
  claseDeEstado,
  ordenarPorHora,
  formatearFechaLarga,
  capitalizar,
} from './agenda.utils';

const CELDAS_EN_GRILLA = 42; // 6 semanas x 7 días
// Orden fijo en el que se muestran los puntos de estado del resumen de cada día.
const ORDEN_ESTADOS = ['', 'pending', 'atendida', 'cancelada', 'no-asistio'];

const VistaMes = ({ fechaActual, citas, onSeleccionarCita, onVerMas }) => {
  const anio = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();
  const hoyIso = toIsoDate(hoy());

  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaActual);

  // Al cambiar de mes, selecciona hoy si cae en el mes visible; si no, el día 1.
  useEffect(() => {
    const ahora = hoy();
    const hoyEnEsteMes = ahora.getFullYear() === anio && ahora.getMonth() === mes;
    setFechaSeleccionada(hoyEnEsteMes ? ahora : new Date(anio, mes, 1));
  }, [anio, mes]);

  const primerDiaMes = new Date(anio, mes, 1);
  const inicioGrid = mondayOf(primerDiaMes);
  const celdas = Array.from({ length: CELDAS_EN_GRILLA }, (_, i) => addDays(inicioGrid, i));

  const citasPorFecha = new Map();
  citas.forEach((cita) => {
    if (!citasPorFecha.has(cita.fecha)) citasPorFecha.set(cita.fecha, []);
    citasPorFecha.get(cita.fecha).push(cita);
  });

  const fechaSeleccionadaIso = toIsoDate(fechaSeleccionada);
  const citasDelDiaSeleccionado = ordenarPorHora(citasPorFecha.get(fechaSeleccionadaIso) || []);

  return (
    <div className="month-wrap">
      <div className="month-calendar">
        <div className="month-head-row">
          {DIAS_SEMANA_CORTO.map((nombre) => (
            <div className="month-head-cell" key={nombre}>
              {nombre}
            </div>
          ))}
        </div>

        <div className="month-grid">
          {celdas.map((fechaCelda) => {
            const fechaIso = toIsoDate(fechaCelda);
            const fueraDeMes = fechaCelda.getMonth() !== mes;
            const citasDelDia = citasPorFecha.get(fechaIso) || [];
            const estadosPresentes = ORDEN_ESTADOS.filter((cls) =>
              citasDelDia.some((c) => claseDeEstado(c.estado) === cls),
            );

            return (
              <div
                key={fechaIso}
                className={`month-cell ${fueraDeMes ? 'outside' : ''} ${fechaIso === hoyIso ? 'today' : ''} ${
                  fechaIso === fechaSeleccionadaIso ? 'selected' : ''
                }`.trim()}
                onClick={() => setFechaSeleccionada(fechaCelda)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setFechaSeleccionada(fechaCelda);
                }}
              >
                <div className="month-daynum">{fechaCelda.getDate()}</div>

                {citasDelDia.length > 0 && (
                  <div className="resumen-badge">
                    <span className="resumen-num">{citasDelDia.length}</span>
                    <span className="resumen-dots">
                      {estadosPresentes.map((cls) => (
                        <span className={`rd ${cls}`.trim()} key={cls || 'confirmada'} />
                      ))}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="side-panel">
        <div className="sp-head">
          <div className="sp-fecha">{capitalizar(formatearFechaLarga(fechaSeleccionada))}</div>
          <Button variant="ghost" size="sm" onClick={() => onVerMas(fechaSeleccionada)}>
            Ver día
          </Button>
        </div>
        <div className="sp-count">
          <b>{citasDelDiaSeleccionado.length}</b>{' '}
          {citasDelDiaSeleccionado.length === 1 ? 'cita programada' : 'citas programadas'}
        </div>

        {citasDelDiaSeleccionado.length === 0 ? (
          <div className="sp-empty">Sin citas programadas.</div>
        ) : (
          <div className="sp-list">
            {citasDelDiaSeleccionado.map((cita) => (
              <div
                key={cita.idCita}
                className={`sp-card ${claseDeEstado(cita.estado)}`.trim()}
                onClick={() => onSeleccionarCita(cita)}
              >
                {cita.hora.slice(0, 5)} · {cita.estado}
                <b>{cita.nombrePaciente}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VistaMes;
