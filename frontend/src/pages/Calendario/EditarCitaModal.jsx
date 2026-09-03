import { useEffect, useState } from 'react';
import { citasService } from '../../services';
import { useNotification } from '../../hooks/useNotification';
import { Button, Modal } from '../../components/common';
import './CitaModal.css';

const mensajeError = (err) =>
  err?.response?.data?.message || 'No se pudo guardar la cita. Intenta de nuevo.';

const EditarCitaModal = ({ open, cita, onClose, onActualizada, onCancelada }) => {
  const { notify } = useNotification();

  const [estados, setEstados] = useState([]);
  const [cargandoEstados, setCargandoEstados] = useState(true);

  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [duracionMinutos, setDuracionMinutos] = useState(30);
  const [idEstadoCita, setIdEstadoCita] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !cita) return;

    setFecha(cita.fecha);
    setHora(cita.hora.slice(0, 5));
    setDuracionMinutos(cita.duracionMinutos);
    setIdEstadoCita(String(cita.idEstadoCita));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    try {
      const citaActualizada = await citasService.update(cita.idCita, {
        idPaciente: cita.idPaciente,
        idUsuario: cita.idUsuario,
        fecha,
        hora,
        duracionMinutos,
        notasAdicionales: cita.notasAdicionales,
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
        Ajusta la fecha, hora, duración o estado de la cita de <strong>{cita.nombrePaciente}</strong>.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field-grid">
          <div className="field full">
            <label htmlFor="editar-paciente">Paciente</label>
            <input id="editar-paciente" type="text" value={cita.nombrePaciente} disabled />
          </div>

          <div className="field">
            <label htmlFor="editar-fecha">Fecha</label>
            <input id="editar-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="editar-hora">Hora</label>
            <input id="editar-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="editar-duracion">Duración</label>
            <select
              id="editar-duracion"
              value={duracionMinutos}
              onChange={(e) => setDuracionMinutos(Number(e.target.value))}
            >
              <option value={30}>30 min</option>
              <option value={60}>1 hora</option>
            </select>
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
                <option key={estado.id} value={estado.id}>
                  {estado.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

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
