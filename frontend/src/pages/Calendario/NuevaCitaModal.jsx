import { useEffect, useState } from 'react';
import { citasService, pacientesService, usuariosService } from '../../services';
import { useNotification } from '../../hooks/useNotification';
import { Button, Modal } from '../../components/common';
import { toIsoDate } from './agenda.utils';
import './CitaModal.css';

const HORA_INICIAL = '09:00';
const DURACION_INICIAL = 30;

const mensajeError = (err) =>
  err?.response?.data?.message || 'No se pudo guardar la cita. Intenta de nuevo.';

const NuevaCitaModal = ({ open, fechaInicial, onClose, onCreada }) => {
  const { notify } = useNotification();

  const [pacientes, setPacientes] = useState([]);
  const [odontologos, setOdontologos] = useState([]);
  const [cargandoListas, setCargandoListas] = useState(true);
  const [errorListas, setErrorListas] = useState(null);

  const [idPaciente, setIdPaciente] = useState('');
  const [idUsuario, setIdUsuario] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState(HORA_INICIAL);
  const [duracionMinutos, setDuracionMinutos] = useState(DURACION_INICIAL);
  const [tipoTratamiento, setTipoTratamiento] = useState('');
  const [notas, setNotas] = useState('');
  const [enviarRecordatorioWhatsApp, setEnviarRecordatorioWhatsApp] = useState(true);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;

    setIdPaciente('');
    setIdUsuario('');
    setFecha(toIsoDate(fechaInicial));
    setHora(HORA_INICIAL);
    setDuracionMinutos(DURACION_INICIAL);
    setTipoTratamiento('');
    setNotas('');
    setEnviarRecordatorioWhatsApp(true);
    setError(null);
    setCargandoListas(true);
    setErrorListas(null);

    let activo = true;
    Promise.all([pacientesService.getAll(), usuariosService.getAll()])
      .then(([listaPacientes, listaUsuarios]) => {
        if (!activo) return;
        setPacientes(listaPacientes);
        setOdontologos(listaUsuarios.filter((u) => u.rol === 'Odontologo'));
      })
      .catch(() => {
        if (activo) setErrorListas('No se pudo cargar la lista de pacientes u odontólogos.');
      })
      .finally(() => {
        if (activo) setCargandoListas(false);
      });

    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!idPaciente) return setError('Selecciona un paciente.');
    if (!idUsuario) return setError('Selecciona un odontólogo.');
    if (!tipoTratamiento.trim()) return setError('Indica el tipo de tratamiento.');

    setGuardando(true);
    try {
      const citaCreada = await citasService.create({
        idPaciente: Number(idPaciente),
        idUsuario: Number(idUsuario),
        fecha,
        hora,
        duracionMinutos,
        tipoTratamiento: tipoTratamiento.trim(),
        notasAdicionales: notas.trim() || null,
        enviarRecordatorioWhatsApp,
      });
      notify('Cita creada correctamente.');
      onCreada(citaCreada);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva cita" wide>
      <p className="cita-modal-sub">Agenda una cita para un paciente registrado.</p>

      <form onSubmit={handleSubmit}>
        <div className="field-grid">
          <div className="field full">
            <label htmlFor="cita-paciente">Paciente</label>
            <select
              id="cita-paciente"
              value={idPaciente}
              onChange={(e) => setIdPaciente(e.target.value)}
              disabled={cargandoListas}
            >
              <option value="">{cargandoListas ? 'Cargando...' : 'Selecciona un paciente'}</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombres} {p.apellidos}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="cita-fecha">Fecha</label>
            <input id="cita-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="cita-hora">Hora</label>
            <input id="cita-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="cita-duracion">Duración</label>
            <select
              id="cita-duracion"
              value={duracionMinutos}
              onChange={(e) => setDuracionMinutos(Number(e.target.value))}
            >
              <option value={30}>30 min</option>
              <option value={60}>1 hora</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="cita-odontologo">Odontólogo</label>
            <select
              id="cita-odontologo"
              value={idUsuario}
              onChange={(e) => setIdUsuario(e.target.value)}
              disabled={cargandoListas}
            >
              <option value="">{cargandoListas ? 'Cargando...' : 'Selecciona un odontólogo'}</option>
              {odontologos.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombreUsuario}
                </option>
              ))}
            </select>
          </div>

          <div className="field full">
            <label htmlFor="cita-tratamiento">Tipo de tratamiento</label>
            <input
              id="cita-tratamiento"
              type="text"
              placeholder="Ej. limpieza, endodoncia, revisión"
              value={tipoTratamiento}
              onChange={(e) => setTipoTratamiento(e.target.value)}
            />
          </div>

          <div className="field full">
            <label htmlFor="cita-notas">Notas</label>
            <textarea
              id="cita-notas"
              placeholder="Notas para la cita"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </div>

        <div className="toggle-line">
          <input
            type="checkbox"
            id="cita-recordatorio"
            checked={enviarRecordatorioWhatsApp}
            onChange={(e) => setEnviarRecordatorioWhatsApp(e.target.checked)}
          />
          <label htmlFor="cita-recordatorio">Enviar recordatorio automático por WhatsApp (24 horas antes)</label>
        </div>

        {errorListas && <p className="cita-modal-mensaje error">{errorListas}</p>}
        {error && <p className="cita-modal-mensaje error">{error}</p>}

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={guardando} disabled={cargandoListas}>
            Guardar cita
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default NuevaCitaModal;
