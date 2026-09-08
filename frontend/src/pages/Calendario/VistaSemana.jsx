import { DIAS_SEMANA_CORTO, addDays, mondayOf, toIsoDate, hoy, claseDeEstado, ordenarPorHora } from './agenda.utils';

const VistaSemana = ({ fechaActual, citas, onSeleccionarCita }) => {
  const lunes = mondayOf(fechaActual);
  const diasDeLaSemana = Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
  const hoyIso = toIsoDate(hoy());

  return (
    <div className="week-lists">
      {diasDeLaSemana.map((dia, i) => {
        const fechaIso = toIsoDate(dia);
        const citasDelDia = ordenarPorHora(citas.filter((c) => c.fecha === fechaIso));

        return (
          <div className={`week-col ${fechaIso === hoyIso ? 'today' : ''}`.trim()} key={fechaIso}>
            <div className="wc-head">
              <div className="wd-name">{DIAS_SEMANA_CORTO[i]}</div>
              <div className="wd-num">{dia.getDate()}</div>
            </div>

            <div className="wc-body">
              {citasDelDia.length === 0 ? (
                <div className="wc-empty">Sin citas</div>
              ) : (
                citasDelDia.map((cita) => (
                  <div
                    key={cita.idCita}
                    className={`wc-card ${claseDeEstado(cita.estado)}`.trim()}
                    onClick={() => onSeleccionarCita(cita)}
                  >
                    <span className="wh">{cita.hora.slice(0, 5)}</span>
                    <span className="wnom">{cita.nombrePaciente}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VistaSemana;
