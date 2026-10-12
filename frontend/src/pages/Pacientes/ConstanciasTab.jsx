import { useEffect, useState } from 'react';
import { constanciasService } from '../../services/constancias.service';
import { Alert, EmptyState, Loader } from '../../components/common';
import { formatDate, formatTime } from '../../utils/formatters';
import { IconBack, IconPlus, IconFileText, IconPrinter, IconUser } from '../Recetario/RecetarioIcons';
import ConstanciaForm from './ConstanciaForm';
import DatosProfesionalesModal from './DatosProfesionalesModal';
import { abrirPdfConstancia } from './constanciaPdf';
import '../Recetario/Recetario.css';
import './Constancias.css';

// Explicación corta de cada plantilla para elegir el tipo (SCRUM-296).
const DESCRIPCION_TIPO = {
  'Extracción de terceras molares':
    'Procedimiento quirúrgico de extracción de tercera(s) molar(es), con días de reposo e indicaciones postoperatorias.',
  'Tratamiento realizado': 'Cualquier otro procedimiento odontológico: se describe el tratamiento realizado.',
};

const nombreDoctor = (doctor) => (doctor ? `${doctor.nombres} ${doctor.apellidos}`.trim() : '');

// SCRUM-294: sección "Constancias" del expediente (solo Odontólogo,
// SCRUM-295/297). SCRUM-300 lista con tipo, fecha de atención, fecha de
// emisión y doctor · SCRUM-301 ver/imprimir · SCRUM-296 elegir el tipo ·
// SCRUM-302 las emitidas no se editan, solo se emite una nueva.
const ConstanciasTab = ({ idPaciente, paciente }) => {
  const [vista, setVista] = useState('lista'); // 'lista' | 'tipo' | 'emitir'
  const [constancias, setConstancias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [datosNueva, setDatosNueva] = useState(null);
  const [tipo, setTipo] = useState(null);
  const [abriendo, setAbriendo] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [editandoDatos, setEditandoDatos] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    Promise.all([constanciasService.getByPaciente(idPaciente), constanciasService.getDatosNueva()])
      .then(([lista, datos]) => {
        if (!activo) return;
        setConstancias(lista);
        setDatosNueva(datos);
      })
      .catch(() => {
        if (activo) setError('No se pudieron cargar las constancias de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  const ver = async (c) => {
    setAbriendo(c.idConstancia);
    setAviso(null);
    try {
      await abrirPdfConstancia(idPaciente, c.idConstancia);
    } catch {
      setAviso({ tipo: 'error', texto: 'No se pudo generar el PDF de la constancia. Intenta de nuevo.' });
    } finally {
      setAbriendo(null);
    }
  };

  const elegirTipo = (t) => {
    setTipo(t);
    setVista('emitir');
  };

  const alEmitir = (dto) => {
    setConstancias((prev) => [dto, ...prev]);
    if (dto.lugarEmision) {
      setDatosNueva((d) => ({ ...d, lugar: dto.lugarEmision }));
    }
    setAviso({ tipo: 'success', texto: 'Constancia emitida correctamente.' });
    setVista('lista');
  };

  // Los datos nuevos firman desde ya las constancias, también las anteriores
  // de este odontólogo (salen con el dato vigente).
  const alGuardarDatos = (doctor) => {
    setDatosNueva((d) => ({ ...d, doctor }));
    setEditandoDatos(false);
    setAviso({ tipo: 'success', texto: 'Datos profesionales guardados.' });
  };

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;

  if (vista === 'emitir' && tipo) {
    return (
      <ConstanciaForm
        idPaciente={idPaciente}
        paciente={paciente}
        tipo={tipo}
        doctor={datosNueva?.doctor}
        lugarInicial={datosNueva?.lugar || ''}
        onEmitida={alEmitir}
        onVolver={() => setVista('tipo')}
      />
    );
  }

  if (vista === 'tipo') {
    return (
      <div className="recetario">
        <div className="recetario-acciones constancia-acciones-izq">
          <button type="button" className="btn btn-secondary btn-md" onClick={() => setVista('lista')}>
            <IconBack /> Volver a constancias
          </button>
        </div>

        <div className="constancia-tipos-titulo">¿Qué tipo de constancia deseas generar?</div>
        <div className="constancia-tipos">
          {(datosNueva?.tipos || []).map((t) => (
            <button type="button" className="constancia-tipo" key={t.idTipoConstancia} onClick={() => elegirTipo(t)}>
              <span className="recetario-item-icono">
                <IconFileText />
              </span>
              <span className="constancia-tipo-nombre">{t.nombre}</span>
              {DESCRIPCION_TIPO[t.nombre] && (
                <span className="constancia-tipo-descripcion">{DESCRIPCION_TIPO[t.nombre]}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const sinDatosDoctor = !datosNueva?.doctor;

  return (
    <div className="recetario">
      {aviso && <Alert type={aviso.tipo}>{aviso.texto}</Alert>}

      {sinDatosDoctor && (
        <Alert type="warning">
          Para emitir constancias primero registra tus datos profesionales (nombre, colegiado y teléfono) con el
          botón &quot;Mis datos profesionales&quot;.
        </Alert>
      )}

      <div className="recetario-acciones">
        {constancias.length > 0 && (
          <span className="recetario-contador">
            {constancias.length} constancia{constancias.length === 1 ? '' : 's'}
          </span>
        )}
        <button type="button" className="btn btn-secondary btn-md" onClick={() => setEditandoDatos(true)}>
          <IconUser /> Mis datos profesionales
        </button>
        <button
          type="button"
          className="btn btn-primary btn-md"
          onClick={() => {
            setAviso(null);
            setVista('tipo');
          }}
          disabled={sinDatosDoctor}
        >
          <IconPlus /> Nueva constancia
        </button>
      </div>

      {constancias.length === 0 ? (
        <EmptyState
          icon={<IconFileText />}
          title="Sin constancias emitidas"
          description="Aún no se ha emitido ninguna constancia odontológica para este paciente."
        />
      ) : (
        <div className="recetario-lista">
          {constancias.map((c) => (
            <button
              type="button"
              className="recetario-item"
              key={c.idConstancia}
              onClick={() => ver(c)}
              disabled={abriendo !== null}
              title="Ver o imprimir la constancia"
            >
              <span className="recetario-item-icono">
                <IconFileText />
              </span>
              <span className="recetario-item-cuerpo">
                <span className="constancia-item-tipo">{c.tipoConstancia}</span>
                <span className="constancia-item-fechas">
                  Atención: {formatDate(c.fechaAtencion?.slice(0, 10))} · Emitida: {formatDate(c.fechaEmision)}{' '}
                  {formatTime(c.fechaEmision)}
                </span>
                <span className="constancia-item-doctor">
                  {c.doctor ? `Dr. ${nombreDoctor(c.doctor)}` : 'Doctor sin datos registrados'}
                </span>
              </span>
              <span className="constancia-item-ver">
                <IconPrinter /> {abriendo === c.idConstancia ? 'Generando…' : 'Ver / imprimir'}
              </span>
            </button>
          ))}
        </div>
      )}

      {editandoDatos && (
        <DatosProfesionalesModal
          open
          datosIniciales={datosNueva?.doctor}
          onCerrar={() => setEditandoDatos(false)}
          onGuardado={alGuardarDatos}
        />
      )}
    </div>
  );
};

export default ConstanciasTab;
