import {
  ALTURA_HORA_PX,
  claseDeEstado,
  formatearRangoHora,
  horasDelDia,
  ordenarPorHora,
  posicionEnGrid,
  toIsoDate,
} from './agenda.utils';

const HORAS_EJE = horasDelDia();
const ALTURA_TOTAL = (HORAS_EJE.length - 1) * ALTURA_HORA_PX;
const ALTURA_MIN_BLOQUE = 40;
// Con nota, el bloque necesita una tercera línea de texto -- si no, una cita
// corta (30 min) queda tan baja que la nota se recorta y no se ve sin abrir
// el detalle, que es justo lo que esto evita.
const ALTURA_MIN_BLOQUE_CON_NOTA = 64;

const VistaDia = ({ fechaActual, citas, bloqueos, onSeleccionarCita }) => {
  const fechaIso = toIsoDate(fechaActual);
  const citasDelDia = ordenarPorHora(citas.filter((c) => c.fecha === fechaIso));
  const bloqueo = bloqueos.find((b) => b.fecha === fechaIso);

  return (
    <div className="day-agenda">
      <div className="agenda-count">
        <b>{citasDelDia.length}</b> {citasDelDia.length === 1 ? 'cita programada' : 'citas programadas'}
      </div>

      {bloqueo && (
        <div className="dia-bloqueado-aviso">
          {bloqueo.nombreOdontologo} no labora este día{bloqueo.motivo ? `: ${bloqueo.motivo}` : '.'}
        </div>
      )}

      <div className="grid-scroll">
        <div className="time-grid">
          <div className="hour-axis">
            {HORAS_EJE.map((h, i) => (
              <div className="hour-label" key={h} style={{ top: i * ALTURA_HORA_PX }}>
                {h}:00
              </div>
            ))}
          </div>

          <div className={`canvas-row ${bloqueo ? 'bloqueado' : ''}`.trim()} style={{ height: ALTURA_TOTAL }}>
            {HORAS_EJE.map((h, i) => (
              <div className="hour-line" key={h} style={{ top: i * ALTURA_HORA_PX }} />
            ))}

            {citasDelDia.length === 0 && (
              <div className="canvas-empty">Sin citas programadas para este día.</div>
            )}

            {citasDelDia.map((cita) => {
              const { top, height } = posicionEnGrid(cita.hora, cita.duracionMinutos);
              const alturaMinima = cita.notasAdicionales ? ALTURA_MIN_BLOQUE_CON_NOTA : ALTURA_MIN_BLOQUE;
              return (
                <div
                  key={cita.idCita}
                  className={`cita-block ${claseDeEstado(cita.estado)}`.trim()}
                  style={{ top, height: Math.max(height, alturaMinima) }}
                  onClick={() => onSeleccionarCita(cita)}
                >
                  <div className="cb-top">
                    <span className="cb-rango">{formatearRangoHora(cita.hora, cita.duracionMinutos)}</span>
                    <span className="cb-dot" />
                  </div>
                  <div className="cb-nombre">{cita.nombrePaciente}</div>
                  {cita.notasAdicionales && <div className="cb-nota">{cita.notasAdicionales}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VistaDia;
