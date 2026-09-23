import { useState } from 'react';
import { bloqueosAgendaService } from '../../services';
import { useNotification } from '../../hooks/useNotification';
import { Button, Modal } from '../../components/common';
import { capitalizar, formatearFechaLarga, toIsoDate } from './agenda.utils';
import './CitaModal.css';

const mensajeError = (err) =>
  err?.response?.data?.message || 'No se pudo guardar el bloqueo. Intenta de nuevo.';

const BloqueoDiaModal = ({ open, fecha, onClose, onCreado }) => {
  const { notify } = useNotification();

  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  if (!fecha) return null;

  const handleClose = () => {
    setMotivo('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const bloqueoCreado = await bloqueosAgendaService.create({
        fecha: toIsoDate(fecha),
        motivo: motivo.trim() || null,
      });
      notify('Día marcado como no laboral.');
      setMotivo('');
      onCreado(bloqueoCreado);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Marcar día no laboral">
      <p className="cita-modal-sub">
        <strong>{capitalizar(formatearFechaLarga(fecha))}</strong> quedará marcado como no disponible: nadie
        va a poder agendar citas nuevas ese día hasta que quites el bloqueo.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field-grid">
          <div className="field full">
            <label htmlFor="bloqueo-motivo">Motivo (opcional)</label>
            <textarea
              id="bloqueo-motivo"
              placeholder="Ej. Vacaciones, capacitación, día festivo..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="cita-modal-mensaje error">{error}</p>}

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={guardando}>
            Marcar día
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default BloqueoDiaModal;
