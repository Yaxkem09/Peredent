import {
  DIAS_SEMANA_CORTO,
  HORA_INICIO,
  HORA_FIN,
  ALTO_HORA,
  minutosDesdeInicio,
  claseDeEstado,
  addDays,
  mondayOf,
  toIsoDate,
  hoy,
} from './agenda.utils';

const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);

const VistaSemana = ({ fechaActual, citas, onSeleccionarCita }) => {
  const lunes = mondayOf(fechaActual);
  const diasDeLaSemana = Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
  const alturaTotal = (HORA_FIN - HORA_INICIO) * ALTO_HORA;
  const hoyIso = toIsoDate(hoy());

  return (
    <div className="week-calendar">
      <div className="week-hours-col">
        <div className="week-day-head" style={{ visibility: 'hidden' }} />
        {HORAS.map((h) => (
          <div className="hour-label" key={h}>{String(h).padStart(2, '0')}:00</div>
        ))}
      </div>

      <div className="week-days">
        {diasDeLaSemana.map((dia, i) => {
          const fechaIso = toIsoDate(dia);
          const citasDelDia = citas.filter((c) => c.fecha === fechaIso);

          return (
            <div className="week-day-col" key={fechaIso}>
              <div className={`week-day-head ${fechaIso === hoyIso ? 'today' : ''}`.trim()}>
                <div className="wd-name">{DIAS_SEMANA_CORTO[i]}</div>
                <div className="wd-num">{dia.getDate()}</div>
              </div>

              <div className="week-slots" style={{ height: alturaTotal }}>
                {HORAS.map((h) => (
                  <div className="hour-row" key={h} />
                ))}

                {citasDelDia.map((cita) => {
                  const top = minutosDesdeInicio(cita.hora);
                  const alto = (ALTO_HORA * cita.duracionMinutos) / 60 - 4;

                  return (
                    <div
                      key={cita.idCita}
                      className={`week-appt ${claseDeEstado(cita.estado)}`.trim()}
                      style={{ top, height: alto }}
                      onClick={() => onSeleccionarCita(cita)}
                    >
                      <b>{cita.hora.slice(0, 5)}</b>
                      <br />
                      {cita.nombrePaciente}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VistaSemana;
