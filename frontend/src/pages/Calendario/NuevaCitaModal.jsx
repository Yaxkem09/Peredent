import { useEffect, useState } from 'react';
import { citasService, pacientesService, usuariosService } from '../../services';
import { useNotification } from '../../hooks/useNotification';
import { Button, Modal } from '../../components/common';
import { estaFueraDeHorarioClinica, toIsoDate } from './agenda.utils';
import './CitaModal.css';

const HORA_INICIAL = '09:00';
const DURACION_INICIAL = 30;
const DEMORA_BUSQUEDA_MS = 400;

const mensajeError = (err) =>
  err?.response?.data?.message || 'No se pudo guardar la cita. Intenta de nuevo.';

const NuevaCitaModal = ({ open, fechaInicial, onClose, onCreada }) => {
  const { notify } = useNotification();

  const [odontologos, setOdontologos] = useState([]);
  const [cargandoListas, setCargandoListas] = useState(true);
  const [errorListas, setErrorListas] = useState(null);

  const [terminoPaciente, setTerminoPaciente] = useState('');
  const [resultadosPacientes, setResultadosPacientes] = useState([]);
  const [buscandoPacientes, setBuscandoPacientes] = useState(false);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);

  const [idPaciente, setIdPaciente] = useState('');
  const [idUsuario, setIdUsuario] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState(HORA_INICIAL);
  const [duracionMinutos, setDuracionMinutos] = useState(DURACION_INICIAL);
  const [notas, setNotas] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;

    setTerminoPaciente('');
    setResultadosPacientes([]);
    setPacienteSeleccionado(null);
    setIdPaciente('');
    setIdUsuario('');
    setFecha(toIsoDate(fechaInicial));
    setHora(HORA_INICIAL);
    setDuracionMinutos(DURACION_INICIAL);
    setNotas('');
    setError(null);
    setCargandoListas(true);
    setErrorListas(null);

    let activo = true;
    usuariosService
      .getAll()
      .then((listaUsuarios) => {
        if (!activo) return;
        setOdontologos(listaUsuarios.filter((u) => u.rol === 'Odontologo'));
      })
      .catch(() => {
        if (activo) setErrorListas('No se pudo cargar la lista de odontólogos.');
      })
      .finally(() => {
        if (activo) setCargandoListas(false);
      });

    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Busca pacientes por nombre a medida que se escribe (con demora para no
  // disparar una request por cada tecla). Si ya hay un paciente elegido, no
  // vuelve a buscar hasta que el usuario borre/edite el texto de nuevo.
  useEffect(() => {
    if (!open || pacienteSeleccionado) return;

    if (!terminoPaciente.trim()) {
      setResultadosPacientes([]);
      return;
    }

    let activo = true;
    setBuscandoPacientes(true);
    const timer = setTimeout(() => {
      pacientesService
        .search(terminoPaciente.trim())
        .then((data) => {
          if (activo) setResultadosPacientes(data);
        })
        .catch(() => {
          if (activo) setResultadosPacientes([]);
        })
        .finally(() => {
          if (activo) setBuscandoPacientes(false);
        });
    }, DEMORA_BUSQUEDA_MS);

    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [terminoPaciente, open, pacienteSeleccionado]);

  const handleTerminoPacienteChange = (valor) => {
    setTerminoPaciente(valor);
    if (pacienteSeleccionado) {
      setPacienteSeleccionado(null);
      setIdPaciente('');
    }
  };

  const seleccionarPaciente = (paciente) => {
    setPacienteSeleccionado(paciente);
    setIdPaciente(String(paciente.id));
    setTerminoPaciente(`${paciente.nombres} ${paciente.apellidos}`);
    setResultadosPacientes([]);
  };

  const fueraDeHorario = hora ? estaFueraDeHorarioClinica(hora, duracionMinutos) : false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!idPaciente) return setError('Selecciona un paciente.');
    if (!idUsuario) return setError('Selecciona un odontólogo.');
    setGuardando(true);
    try {
      const citaCreada = await citasService.create({
        idPaciente: Number(idPaciente),
        idUsuario: Number(idUsuario),
        fecha,
        hora,
        duracionMinutos,
        notasAdicionales: notas.trim() || null,
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
            <input
              id="cita-paciente"
              type="text"
              placeholder="Busca por nombre, apellido o teléfono"
              value={terminoPaciente}
              onChange={(e) => handleTerminoPacienteChange(e.target.value)}
              autoComplete="off"
            />
            {buscandoPacientes && <p className="cita-modal-mensaje">Buscando...</p>}
            {!pacienteSeleccionado && resultadosPacientes.length > 0 && (
              <ul className="cita-paciente-resultados">
                {resultadosPacientes.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => seleccionarPaciente(p)}>
                      {p.nombres} {p.apellidos}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="field">
            <label htmlFor="cita-fecha">Fecha</label>
            <input
              id="cita-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              min={toIsoDate(new Date())}
            />
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
            <label htmlFor="cita-notas">Notas</label>
            <textarea
              id="cita-notas"
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
