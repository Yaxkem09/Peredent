import { useEffect, useState } from 'react';
import { consentimientosService } from '../../services/consentimientos.service';
import { Alert, EmptyState, Loader } from '../../components/common';
import { formatDate } from '../../utils/formatters';
import { IconPlus, IconChevronRight, IconFileText } from '../Recetario/RecetarioIcons';
import ConsentimientoForm from './ConsentimientoForm';
import '../Recetario/Recetario.css';
import './Consentimientos.css';

const PROCEDIMIENTO_POR_DEFECTO = 'Exodoncia quirúrgica de terceros molares incluidos';

// Fecha de hoy como "yyyy-mm-dd" en hora local (no UTC), para el input date.
const hoyLocal = () => {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

// SCRUM-254: sección "Consentimientos" del expediente. SCRUM-255 botón
// "Nuevo consentimiento" · SCRUM-261 lista con fecha, procedimiento, doctor y
// estado · SCRUM-257..264 formulario, guardado como borrador e impresión.
const ConsentimientosTab = ({ idPaciente, paciente }) => {
  const [vista, setVista] = useState('lista'); // 'lista' | 'editar'
  const [consentimientos, setConsentimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [valoresNuevo, setValoresNuevo] = useState(null);
  const [preparandoNuevo, setPreparandoNuevo] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    consentimientosService
      .getByPaciente(idPaciente)
      .then((data) => {
        if (activo) setConsentimientos(data);
      })
      .catch(() => {
        if (activo) setError('No se pudieron cargar los consentimientos de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  // Precarga: datos del paciente (y su encargado si es menor) y el doctor,
  // colegiado y lugar del último consentimiento que hizo el mismo usuario.
  // El procedimiento viene escrito pero se puede cambiar para otras cirugías.
  const nuevo = async () => {
    setPreparandoNuevo(true);
    let ultimo = null;
    try {
      ultimo = await consentimientosService.getUltimoDelUsuario();
    } catch {
      ultimo = null;
    }

    setValoresNuevo({
      nombrePaciente: paciente ? `${paciente.nombres} ${paciente.apellidos}`.trim() : '',
      documentoPaciente: '',
      nombreRepresentante: paciente?.encargadoNombre || '',
      nombreDoctor: ultimo?.nombreDoctor || '',
      colegiadoDoctor: ultimo?.colegiadoDoctor || '',
      procedimiento: PROCEDIMIENTO_POR_DEFECTO,
      riesgosEspecificos: '',
      observaciones: '',
      lugar: ultimo?.lugar || '',
      fechaConsentimiento: hoyLocal(),
    });
    setSeleccionado(null);
    setPreparandoNuevo(false);
    setVista('editar');
  };

  const abrir = (c) => {
    setSeleccionado(c);
    setVista('editar');
  };

  const alGuardar = (dto) => {
    setConsentimientos((prev) => {
      const existe = prev.some((c) => c.idConsentimiento === dto.idConsentimiento);
      return existe
        ? prev.map((c) => (c.idConsentimiento === dto.idConsentimiento ? dto : c))
        : [dto, ...prev];
    });
  };

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;

  if (vista === 'editar') {
    return (
      <ConsentimientoForm
        key={seleccionado?.idConsentimiento ?? 'nuevo'}
        idPaciente={idPaciente}
        consentimiento={seleccionado}
        valoresIniciales={valoresNuevo}
        onGuardado={alGuardar}
        onVolver={() => setVista('lista')}
      />
    );
  }

  return (
    <div className="recetario">
      <div className="recetario-acciones">
        {consentimientos.length > 0 && (
          <span className="recetario-contador">
            {consentimientos.length} consentimiento{consentimientos.length === 1 ? '' : 's'}
          </span>
        )}
        <button type="button" className="btn btn-primary btn-md" onClick={nuevo} disabled={preparandoNuevo}>
          <IconPlus /> {preparandoNuevo ? 'Preparando…' : 'Nuevo consentimiento'}
        </button>
      </div>

      {consentimientos.length === 0 ? (
        <EmptyState
          icon={<IconFileText />}
          title="Sin consentimientos registrados"
          description="Aún no se ha generado ningún consentimiento informado para este paciente."
        />
      ) : (
        <div className="recetario-lista">
          {consentimientos.map((c) => (
            <button
              type="button"
              className={`recetario-item${c.estado === 'Impreso' ? '' : ' tono-amber'}`}
              key={c.idConsentimiento}
              onClick={() => abrir(c)}
            >
              <span className="recetario-item-icono">
                <IconFileText />
              </span>
              <span className="recetario-item-cuerpo">
                <span className="recetario-item-fecha">{formatDate(c.fechaConsentimiento?.slice(0, 10))}</span>
                <span className="consent-item-procedimiento">{c.procedimiento}</span>
                <span className="consent-item-doctor">Dr. {c.nombreDoctor}</span>
              </span>
              <span className={`tag ${c.estado === 'Impreso' ? 'tag-ok' : 'tag-pending'}`}>{c.estado}</span>
              <span className="recetario-item-chevron">
                <IconChevronRight />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsentimientosTab;
