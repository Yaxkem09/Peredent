import {
  HORA_INICIO,
  HORA_FIN,
  ALTO_HORA,
  minutosDesdeInicio,
  claseDeEstado,
  toIsoDate,
} from './agenda.utils';

const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);

const VistaDia = ({ fechaActual, citas, onSeleccionarCita }) => {
  const fechaIso = toIsoDate(fechaActual);
  const citasDelDia = citas.filter((c) => c.fecha === fechaIso);
  const alturaTotal = (HORA_FIN - HORA_INICIO) * ALTO_HORA;

  return (
    <div className="day-calendar">
      <div className="hours-col">
        {HORAS.map((h) => (
          <div className="hour-label" key={h}>{String(h).padStart(2, '0')}:00</div>
        ))}
      </div>
      <div className="slots-col" style={{ height: alturaTotal }}>
        {HORAS.map((h) => (
          <div className="hour-row" key={h} />
        ))}

        {citasDelDia.length === 0 && (
          <div className="appt-empty">Sin citas programadas para este día.</div>
        )}

        {citasDelDia.map((cita) => {
          const top = minutosDesdeInicio(cita.hora);
          const alto = (ALTO_HORA * cita.duracionMinutos) / 60 - 4;

          return (
            <div
              key={cita.idCita}
              className={`appt-block ${claseDeEstado(cita.estado)}`.trim()}
              style={{ top, height: alto }}
              onClick={() => onSeleccionarCita(cita)}
            >
              <span className="appt-time">{cita.hora.slice(0, 5)}</span>
              {cita.nombrePaciente} — {cita.tipoTratamiento}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VistaDia;
