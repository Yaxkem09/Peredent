import {
  DIAS_SEMANA_CORTO,
  addDays,
  mondayOf,
  toIsoDate,
  hoy,
  claseDeEstado,
  ordenarPorHora,
} from './agenda.utils';

const MAX_VISIBLES = 3;
const CELDAS_EN_GRILLA = 42; // 6 semanas x 7 días

const VistaMes = ({ fechaActual, citas, onSeleccionarCita, onVerMas }) => {
  const anio = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();
  const primerDiaMes = new Date(anio, mes, 1);
  const inicioGrid = mondayOf(primerDiaMes);
  const celdas = Array.from({ length: CELDAS_EN_GRILLA }, (_, i) => addDays(inicioGrid, i));
  const hoyIso = toIsoDate(hoy());

  const citasPorFecha = new Map();
  citas.forEach((cita) => {
    if (!citasPorFecha.has(cita.fecha)) citasPorFecha.set(cita.fecha, []);
    citasPorFecha.get(cita.fecha).push(cita);
  });

  return (
    <div className="month-calendar">
      <div className="month-head-row">
        {DIAS_SEMANA_CORTO.map((nombre) => (
          <div className="month-head-cell" key={nombre}>{nombre}</div>
        ))}
      </div>

      <div className="month-grid">
        {celdas.map((fechaCelda) => {
          const fechaIso = toIsoDate(fechaCelda);
          const fueraDeMes = fechaCelda.getMonth() !== mes;
          const citasDelDia = ordenarPorHora(citasPorFecha.get(fechaIso) || []);
          const visibles = citasDelDia.slice(0, MAX_VISIBLES);
          const restantes = citasDelDia.length - visibles.length;

          return (
            <div
              key={fechaIso}
              className={`month-cell ${fueraDeMes ? 'outside' : ''} ${fechaIso === hoyIso ? 'today' : ''}`.trim()}
              onClick={() => onVerMas(fechaCelda)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onVerMas(fechaCelda);
              }}
            >
              <div className="month-daynum">{fechaCelda.getDate()}</div>

              {visibles.map((cita) => (
                <div
                  key={cita.idCita}
                  className={`month-appt ${claseDeEstado(cita.estado)}`.trim()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeleccionarCita(cita);
                  }}
                >
                  {cita.hora.slice(0, 5)} {cita.nombrePaciente}
                </div>
              ))}

              {restantes > 0 && (
                <div
                  className="month-more"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerMas(fechaCelda);
                  }}
                >
                  +{restantes} más
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VistaMes;
