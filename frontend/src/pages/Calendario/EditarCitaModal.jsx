import { useEffect, useState } from 'react';
import { citasService } from '../../services';
import { useNotification } from '../../hooks/useNotification';
import { Button, Modal } from '../../components/common';
import {
  INCREMENTO_MINUTOS,
  esCitaPasada,
  estaFueraDeHorarioClinica,
  horaAMinutos,
  minutosAHora,
  sumarMinutos,
  toIsoDate,
} from './agenda.utils';
import './CitaModal.css';

const ESTADOS_QUE_REQUIEREN_CITA_YA_OCURRIDA = ['Atendida', 'No Asistio'];

const mensajeError = (err) =>
  err?.response?.data?.message || 'No se pudo guardar la cita. Intenta de nuevo.';

const EditarCitaModal = ({ open, cita, onClose, onActualizada, onCancelada }) => {
  const { notify } = useNotification();

  const [estados, setEstados] = useState([]);
  const [cargandoEstados, setCargandoEstados] = useState(true);

  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [idEstadoCita, setIdEstadoCita] = useState('');
  const [notas, setNotas] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
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

  const handleCancelarCita = async () => {
    setError(null);
    setCancelando(true);
    try {
      const citaCancelada = await citasService.cancelar(cita.idCita);
      notify('Cita cancelada.');
      onCancelada(citaCancelada);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCancelando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Modificar cita" wide>
      <p className="cita-modal-sub">
        Ajusta la fecha, horario o estado de la cita de <strong>{cita.nombrePaciente}</strong>.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field-grid">
          <div className="field full">
            <label htmlFor="editar-paciente">Paciente</label>
            <input id="editar-paciente" type="text" value={cita.nombrePaciente} disabled />
          </div>

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
            <input
              id="editar-hora"
              type="time"
              value={hora}
              onChange={(e) => cambiarHoraInicio(e.target.value)}
              min="07:00"
              max="19:00"
              step={INCREMENTO_MINUTOS * 60}
              disabled={citaYaPaso}
            />
          </div>

          <div className="field">
            <label htmlFor="editar-hora-fin">Hora de fin</label>
            <input
              id="editar-hora-fin"
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              min="07:00"
              max="19:00"
              step={INCREMENTO_MINUTOS * 60}
              disabled={citaYaPaso}
            />
          </div>

          <div className="field">
            <label htmlFor="editar-estado">Estado</label>
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

          <div className="field full">
            <label htmlFor="editar-notas">Notas</label>
            <textarea
              id="editar-notas"
              placeholder="Notas para la cita"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </div>

        {fueraDeHorario && (
          <p className="cita-modal-mensaje aviso">
            Fuera del horario 7:00–19:00 — el sistema no permitirá guardar.
          </p>
        )}

        {error && <p className="cita-modal-mensaje error">{error}</p>}

        <div className="modal-actions split">
          <Button type="button" variant="danger" onClick={handleCancelarCita} loading={cancelando}>
            Cancelar esta cita
          </Button>
          <div className="modal-actions-right">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            <Button type="submit" variant="primary" loading={guardando} disabled={cargandoEstados}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default EditarCitaModal;
