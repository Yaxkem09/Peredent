import { useEffect, useState } from 'react';
import { citasService } from '../../services';
import { useNotification } from '../../hooks/useNotification';
import { Button, Modal } from '../../components/common';
import {
  INCREMENTO_MINUTOS,
  claseDeEstado,
  esCitaPasada,
  estaFueraDeHorarioClinica,
  formatearDuracion,
  horaAMinutos,
  minutosAHora,
  sumarMinutos,
  toIsoDate,
} from './agenda.utils';
import SelectorHora from './SelectorHora';
import './CitaModal.css';

const ESTADOS_QUE_REQUIEREN_CITA_YA_OCURRIDA = ['Atendida', 'No Asistio'];

const mensajeError = (err) =>
  err?.response?.data?.message || 'No se pudo guardar la cita. Intenta de nuevo.';

// Para cancelar una cita se elige el estado "Cancelada" en el select y se
// guarda: no hay botón aparte.
const EditarCitaModal = ({ open, cita, onClose, onActualizada }) => {
  const { notify } = useNotification();

  const [estados, setEstados] = useState([]);
  const [cargandoEstados, setCargandoEstados] = useState(true);

  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [idEstadoCita, setIdEstadoCita] = useState('');
  const [notas, setNotas] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !cita) return;

    setFecha(cita.fecha);
    setHora(cita.hora.slice(0, 5));
    setHoraFin(sumarMinutos(cita.hora, cita.duracionMinutos));
    setIdEstadoCita(String(cita.idEstadoCita));
    setNotas(cita.notasAdicionales || '');
    setError(null);
    setCargandoEstados(true);

    let activo = true;
    citasService
      .getEstados()
      .then((data) => {
        if (activo) setEstados(data);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el catálogo de estados.');
      })
      .finally(() => {
        if (activo) setCargandoEstados(false);
      });

    return () => {
      activo = false;
    };
  }, [open, cita]);

  if (!cita) return null;

  const duracionMinutos = hora && horaFin ? horaAMinutos(horaFin) - horaAMinutos(hora) : 0;
  const nombreEstado = estados.find((e) => String(e.id) === String(idEstadoCita))?.nombre;

  // Al mover la hora de inicio se conserva la duración elegida (la hora de fin
  // se corre junto con ella), igual que al arrastrar la cita en la agenda.
  const cambiarHoraInicio = (nuevaHora) => {
    if (nuevaHora && hora && horaFin && duracionMinutos > 0) {
      setHoraFin(minutosAHora(Math.min(horaAMinutos(nuevaHora) + duracionMinutos, 24 * 60 - 1)));
    }
    setHora(nuevaHora);
  };

  // La cita original ya pasó: la fecha/hora queda fija (no se puede reprogramar
  // historial). El backend es la autoridad real de esto; acá solo es UX.
  const citaYaPaso = esCitaPasada(cita.fecha, cita.hora);

  // Con la fecha/hora que hay AHORA en el formulario (no la original): decide si
  // Atendida/No Asistió tienen sentido todavía y si cae fuera de 7:00-19:00.
  const nuevaCitaTodaviaNoLlega = fecha && hora ? !esCitaPasada(fecha, hora) : false;
  const fueraDeHorario = hora && duracionMinutos > 0 ? estaFueraDeHorarioClinica(hora, duracionMinutos) : false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (duracionMinutos < INCREMENTO_MINUTOS) {
      return setError(`La hora de fin debe ser al menos ${INCREMENTO_MINUTOS} min después de la de inicio.`);
    }
    setGuardando(true);

    try {
      const citaActualizada = await citasService.update(cita.idCita, {
        idPaciente: cita.idPaciente,
        idUsuario: cita.idUsuario,
        fecha,
        hora,
        duracionMinutos,
        notasAdicionales: notas.trim() || null,
        idEstadoCita: Number(idEstadoCita),
      });
      notify('Cita actualizada correctamente.');
      onActualizada(citaActualizada);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Modificar cita" wide>
      <p className="cita-modal-sub">
        Ajusta la fecha, horario o estado de la cita de <strong>{cita.nombrePaciente}</strong>.
      </p>

      <form className="cita-form" onSubmit={handleSubmit}>
        <section className="cita-seccion cita-seccion-paciente">
          <span className="cita-seccion-icono">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="3.6" />
                <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
              </svg>
          </span>
          <div>
            <span className="cita-paciente-etiqueta">Paciente</span>
            <span className="cita-paciente-nombre">{cita.nombrePaciente}</span>
          </div>
        </section>

        <section className="cita-seccion">
          <h4 className="cita-seccion-titulo">
            <span className="cita-seccion-icono">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </svg>
            </span>
            Fecha y horario
            <span className={`cita-duracion${duracionMinutos > 0 ? '' : ' invalida'}`}>
              Duración: {formatearDuracion(duracionMinutos)}
            </span>
          </h4>
          {citaYaPaso && (
            <p className="cita-seccion-nota">Esta cita ya pasó: la fecha y el horario no se pueden cambiar.</p>
          )}
          <div className="cita-horario">
            <div className="field">
              <label htmlFor="editar-fecha">Fecha</label>
              <input
                id="editar-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                disabled={citaYaPaso}
                min={citaYaPaso ? undefined : toIsoDate(new Date())}
              />
            </div>
            <div className="field">
              <label htmlFor="editar-hora">Hora de inicio</label>
              <SelectorHora id="editar-hora" value={hora} onChange={cambiarHoraInicio} disabled={citaYaPaso} />
            </div>
            <div className="field">
              <label htmlFor="editar-hora-fin">Hora de fin</label>
              <SelectorHora id="editar-hora-fin" value={horaFin} onChange={setHoraFin} disabled={citaYaPaso} />
            </div>
          </div>
        </section>

        <section className="cita-seccion">
          <h4 className="cita-seccion-titulo">
            <span className="cita-seccion-icono">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20z" />
                <path d="M9 11h6M9 14.5h6M9 18h3.5" />
              </svg>
            </span>
            Estado y notas
          </h4>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="editar-estado">Estado</label>
              <div className="cita-estado-select">
                <span className={`cita-estado-punto ${claseDeEstado(nombreEstado)}`.trim()} aria-hidden="true" />
                <select
                  id="editar-estado"
                  value={idEstadoCita}
                  onChange={(e) => setIdEstadoCita(e.target.value)}
                  disabled={cargandoEstados}
                >
                  {estados.map((estado) => (
                    <option
                      key={estado.id}
                      value={estado.id}
                      disabled={
                        nuevaCitaTodaviaNoLlega && ESTADOS_QUE_REQUIEREN_CITA_YA_OCURRIDA.includes(estado.nombre)
                      }
                    >
                      {estado.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field full">
              <label htmlFor="editar-notas">Notas</label>
              <textarea
                id="editar-notas"
                placeholder="Notas para la cita (opcional)"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
          </div>
        </section>

        {fueraDeHorario && (
          <p className="cita-modal-mensaje aviso">
            Fuera del horario 7:00 AM – 7:00 PM — el sistema no permitirá guardar.
          </p>
        )}

        {error && <p className="cita-modal-mensaje error">{error}</p>}

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="submit" variant="primary" loading={guardando} disabled={cargandoEstados}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditarCitaModal;
