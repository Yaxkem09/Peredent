import {
  ALTURA_HORA_PX,
  DIAS_SEMANA_CORTO,
  addDays,
  claseDeEstado,
  formatearRangoHora,
  horasDelDia,
  hoy,
  mondayOf,
  ordenarPorHora,
  posicionEnGrid,
  toIsoDate,
} from './agenda.utils';

const HORAS_EJE = horasDelDia();
const ALTURA_TOTAL = (HORAS_EJE.length - 1) * ALTURA_HORA_PX;
const ALTURA_MIN_BLOQUE = 30;

const VistaSemana = ({ fechaActual, citas, bloqueos, onSeleccionarCita }) => {
  const lunes = mondayOf(fechaActual);
  const diasDeLaSemana = Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
  const hoyIso = toIsoDate(hoy());

  return (
    <div className="week-agenda">
      <div className="week-head-row">
        <div className="week-head-spacer" />
        {diasDeLaSemana.map((dia, i) => {
          const fechaIso = toIsoDate(dia);
          const bloqueado = bloqueos.some((b) => b.fecha === fechaIso);
          return (
            <div
              className={`week-head-cell ${fechaIso === hoyIso ? 'today' : ''} ${bloqueado ? 'bloqueado' : ''}`.trim()}
              key={fechaIso}
            >
              <div className="wd-name">{DIAS_SEMANA_CORTO[i]}</div>
              <div className="wd-num">{dia.getDate()}</div>
              {bloqueado && <div className="wd-bloqueado">No labora</div>}
            </div>
          );
        })}
      </div>

      <div className="grid-scroll">
        <div className="week-shell">
          <div className="hour-axis">
            {HORAS_EJE.map((h, i) => (
              <div className="hour-label" key={h} style={{ top: i * ALTURA_HORA_PX }}>
                {h}:00
              </div>
            ))}
          </div>

          <div className="week-days">
            {diasDeLaSemana.map((dia) => {
              const fechaIso = toIsoDate(dia);
              const citasDelDia = ordenarPorHora(citas.filter((c) => c.fecha === fechaIso));
              const bloqueado = bloqueos.some((b) => b.fecha === fechaIso);

              return (
                <div
                  className={`week-col ${fechaIso === hoyIso ? 'today' : ''} ${bloqueado ? 'bloqueado' : ''}`.trim()}
                  style={{ height: ALTURA_TOTAL }}
                  key={fechaIso}
                >
                  {HORAS_EJE.map((h, i) => (
                    <div className="hour-line" key={h} style={{ top: i * ALTURA_HORA_PX }} />
                  ))}

                  {citasDelDia.map((cita) => {
                    const { top, height } = posicionEnGrid(cita.hora, cita.duracionMinutos);
                    return (
                      <div
                        key={cita.idCita}
                        className={`wk-block ${claseDeEstado(cita.estado)}`.trim()}
                        style={{ top, height: Math.max(height, ALTURA_MIN_BLOQUE) }}
                        onClick={() => onSeleccionarCita(cita)}
                      >
                        <span className="wk-rango">{formatearRangoHora(cita.hora, cita.duracionMinutos)}</span>
                        <span className="wk-nombre">{cita.nombrePaciente}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VistaSemana;
