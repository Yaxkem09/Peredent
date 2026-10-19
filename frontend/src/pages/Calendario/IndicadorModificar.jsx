import { esCitaPasada } from './agenda.utils';

// Valor de Citas.RespuestaPaciente cuando el paciente tocó "Modificar mi cita"
// en el recordatorio de WhatsApp (ver RespuestaRecordatorioWhatsApp en el backend).
const RESPUESTA_MODIFICAR = 'Modificar';

const TEXTO = 'El paciente pidió modificar su cita';

// Solo mientras requiere seguimiento: si la cita ya pasó o se canceló, no.
// Al reprogramar la cita, el backend limpia la respuesta y el indicador desaparece.
export const debeMostrarIndicadorModificar = (cita) =>
  cita?.respuestaPaciente === RESPUESTA_MODIFICAR && cita.estado !== 'Cancelada' && !esCitaPasada(cita.fecha, cita.hora);

// Ícono pequeño junto al nombre del paciente en las tarjetas del Calendario.
// Recibe la cita tal como vino del servidor (en Día/Semana, `cita.original`,
// no la vista previa del arrastre).
const IndicadorModificar = ({ cita }) => {
  if (!debeMostrarIndicadorModificar(cita)) return null;

  return (
    <span className="indicador-modificar" title={TEXTO} aria-label={TEXTO} role="img">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 3.5h4l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5l1.5-2.5 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5.5a2 2 0 0 1 2-2Z" />
      </svg>
    </span>
  );
};

export default IndicadorModificar;
