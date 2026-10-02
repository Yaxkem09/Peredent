import { useState } from 'react';
import { consentimientosService } from '../../services/consentimientos.service';
import { useAuth } from '../../hooks/useAuth';
import { Alert } from '../../components/common';
import { formatDate, formatTime } from '../../utils/formatters';
import { IconBack, IconPrinter } from '../Recetario/RecetarioIcons';
import logo from '../../assets/logo.png';
import './Consentimientos.css';

// Texto fijo del formato (SCRUM-258): no es editable. Debe coincidir con
// backend/Services/ConsentimientoPdfService.cs, que es el que se imprime.
const COMPLICACIONES = [
  'Alergia al anestésico u otro medicamento utilizado, antes, durante o después de la cirugía.',
  'Hematoma e hinchazón de la región.',
  'Hemorragia postoperatoria.',
  'Apertura de los puntos de sutura.',
  'Daño a los dientes vecinos.',
  'Falta de sensibilidad parcial o total, temporal o permanente del nervio dentario inferior (sensibilidad del labio inferior).',
  'Falta de sensibilidad parcial o total del nervio lingual, temporal o definitiva (de la lengua y del gusto).',
  'Falta de sensibilidad parcial o total del nervio infraorbitario (de la mejilla), temporal o definitiva.',
  'Infección de los tejidos o del hueso.',
  'Sinusitis.',
  'Comunicación entre la boca y la nariz o los senos maxilares.',
  'Fracturas óseas.',
  'Desplazamiento de dientes a estructuras vecinas.',
  'Tragado o aspiración de dientes o de alguna de sus partes.',
  'Rotura de instrumentos. Rotura de la aguja de anestesia.',
  'Infección de los puntos de sutura.',
];

// SCRUM-259: obligatorios para guardar e imprimir.
const OBLIGATORIOS = {
  nombrePaciente: 'Nombre del paciente',
  documentoPaciente: 'Documento de identificación',
  nombreDoctor: 'Doctor',
  procedimiento: 'Procedimiento',
  fechaConsentimiento: 'Fecha',
};

const LIMITES = {
  nombrePaciente: 200,
  documentoPaciente: 30,
  nombreRepresentante: 200,
  nombreDoctor: 200,
  colegiadoDoctor: 50,
  procedimiento: 300,
  riesgosEspecificos: 1000,
  observaciones: 1000,
  lugar: 100,
};

const NOMBRE_PDF_POR_DEFECTO = 'consentimiento.pdf';

const nombreArchivoDesde = (contentDisposition) => {
  if (!contentDisposition) return NOMBRE_PDF_POR_DEFECTO;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition);
  return match ? decodeURIComponent(match[1]) : NOMBRE_PDF_POR_DEFECTO;
};

const aFormulario = (c) => ({
  nombrePaciente: c.nombrePaciente || '',
  documentoPaciente: c.documentoPaciente || '',
  nombreRepresentante: c.nombreRepresentante || '',
  nombreDoctor: c.nombreDoctor || '',
  colegiadoDoctor: c.colegiadoDoctor || '',
  procedimiento: c.procedimiento || '',
  riesgosEspecificos: c.riesgosEspecificos || '',
  observaciones: c.observaciones || '',
  lugar: c.lugar || '',
  fechaConsentimiento: (c.fechaConsentimiento || '').slice(0, 10),
});

const camposFaltantes = (form) =>
  Object.keys(OBLIGATORIOS).filter((campo) => !form[campo]?.trim());

// Formulario con el texto del formato y los campos editables en su lugar
// (SCRUM-257). `consentimiento` es el DTO guardado (null si es nuevo) y
// `valoresIniciales` la precarga para uno nuevo.
const ConsentimientoForm = ({ idPaciente, consentimiento, valoresIniciales, onGuardado, onVolver }) => {
  const { user } = useAuth();
  const [guardado, setGuardado] = useState(consentimiento);
  const [form, setForm] = useState(() => aFormulario(consentimiento || valoresIniciales));
  const [ultimoGuardado, setUltimoGuardado] = useState(() =>
    consentimiento ? aFormulario(consentimiento) : null,
  );
  const [invalidos, setInvalidos] = useState([]);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);

  const hayCambios = !ultimoGuardado || JSON.stringify(form) !== JSON.stringify(ultimoGuardado);
  const ocupado = guardando || imprimiendo;

  const cambiar = (campo) => (e) => {
    const valor = e.target.value;
    setForm((f) => ({ ...f, [campo]: valor }));
    if (invalidos.includes(campo)) {
      setInvalidos((prev) => prev.filter((c) => c !== campo));
    }
  };

  const marcarFaltantes = (faltantes) => {
    setInvalidos(faltantes);
    const nombres = faltantes.map((c) => OBLIGATORIOS[c] || c).join(', ');
    setError(`Falta completar: ${nombres}.`);
  };

  // Devuelve el DTO guardado, o null si no se pudo guardar.
  const guardar = async () => {
    const faltantes = camposFaltantes(form);
    if (faltantes.length > 0) {
      marcarFaltantes(faltantes);
      return null;
    }

    setGuardando(true);
    setError(null);
    try {
      const payload = { ...form };
      const dto = guardado
        ? await consentimientosService.actualizar(idPaciente, guardado.idConsentimiento, payload)
        : await consentimientosService.crear(idPaciente, payload);
      setGuardado(dto);
      setUltimoGuardado(form);
      setInvalidos([]);
      onGuardado(dto);
      return dto;
    } catch (err) {
      const campos = err.response?.data?.campos;
      if (err.response?.status === 400 && Array.isArray(campos) && campos.length > 0) {
        setInvalidos(campos);
        setError(err.response.data.message);
      } else {
        setError('No se pudo guardar el consentimiento. Intenta de nuevo.');
      }
      return null;
    } finally {
      setGuardando(false);
    }
  };

  // SCRUM-262: guarda si hay cambios pendientes y abre el PDF generado por el
  // backend en otra pestaña para imprimirlo. La pestaña se abre antes de las
  // llamadas para que el navegador no la bloquee como ventana emergente.
  const imprimir = async () => {
    const faltantes = camposFaltantes(form);
    if (faltantes.length > 0) {
      marcarFaltantes(faltantes);
      return;
    }

    const ventana = window.open('', '_blank');
    if (ventana) {
      ventana.document.title = 'Generando consentimiento…';
      ventana.document.body.innerText = 'Generando el consentimiento, espera un momento…';
    }

    const dto = hayCambios ? await guardar() : guardado;
    if (!dto) {
      ventana?.close();
      return;
    }

    setImprimiendo(true);
    setError(null);
    try {
      const respuesta = await consentimientosService.imprimir(idPaciente, dto.idConsentimiento);
      const url = URL.createObjectURL(new Blob([respuesta.data], { type: 'application/pdf' }));

      if (ventana) {
        ventana.location.href = url;
      } else {
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombreArchivoDesde(respuesta.headers['content-disposition']);
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      // SCRUM-263: refleja el cambio de estado y la nueva impresión sin
      // volver a pedir la lista.
      const actualizado = {
        ...dto,
        estado: 'Impreso',
        impresiones: [
          { fechaImpresion: new Date().toISOString(), usuario: user?.usuario || '' },
          ...(dto.impresiones || []),
        ],
      };
      setGuardado(actualizado);
      onGuardado(actualizado);
    } catch {
      ventana?.close();
      setError('No se pudo generar el PDF del consentimiento. Intenta de nuevo.');
    } finally {
      setImprimiendo(false);
    }
  };

  const campo = (nombre, { placeholder, ancho = 'md', tipo = 'text' } = {}) => (
    <input
      type={tipo}
      className={`consent-input consent-input-${ancho}${invalidos.includes(nombre) ? ' invalido' : ''}`}
      value={form[nombre]}
      onChange={cambiar(nombre)}
      placeholder={placeholder}
      maxLength={LIMITES[nombre]}
      aria-label={placeholder}
      disabled={ocupado}
    />
  );

  const area = (nombre, placeholder) => (
    <textarea
      className={`consent-textarea${invalidos.includes(nombre) ? ' invalido' : ''}`}
      rows={2}
      value={form[nombre]}
      onChange={cambiar(nombre)}
      placeholder={placeholder}
      maxLength={LIMITES[nombre]}
      aria-label={placeholder}
      disabled={ocupado}
    />
  );

  const procedimiento = form.procedimiento.trim();
  const doctor = form.nombreDoctor.trim();
  const estado = guardado?.estado;

  return (
    <div className="consent">
      <div className="receta-doc-acciones">
        <div className="receta-doc-acciones-grupo">
          <button type="button" className="btn btn-secondary btn-md" onClick={onVolver} disabled={ocupado}>
            <IconBack /> Volver a consentimientos
          </button>
          {estado && (
            <span className={`tag ${estado === 'Impreso' ? 'tag-ok' : 'tag-pending'} consent-estado`}>
              {estado}
            </span>
          )}
          {guardado && hayCambios && <span className="consent-sin-guardar">Cambios sin guardar</span>}
        </div>
        <div className="receta-doc-acciones-grupo">
          <button
            type="button"
            className="btn btn-outline-teal btn-md"
            onClick={guardar}
            disabled={ocupado || !hayCambios}
          >
            {guardando ? 'Guardando…' : guardado ? 'Guardar cambios' : 'Guardar borrador'}
          </button>
          <button type="button" className="btn btn-primary btn-md" onClick={imprimir} disabled={ocupado}>
            <IconPrinter /> {imprimiendo ? 'Generando…' : 'Imprimir'}
          </button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="consent-doc">
        <div className="consent-logo">
          <img src={logo} alt="Peredent" />
        </div>

        <h3 className="consent-titulo">
          CONSENTIMIENTO INFORMADO PARA LA EXODONCIA QUIRÚRGICA DE TERCEROS MOLARES INCLUIDOS
        </h3>

        <p className="consent-nota">
          Los campos marcados con <strong>*</strong> son obligatorios. Los que dejes vacíos se imprimen
          como línea punteada para llenarlos a mano.
        </p>

        <p>
          Para satisfacción de los DERECHOS DEL PACIENTE, como instrumento favorecedor del correcto uso de
          los Procedimientos Diagnósticos y Terapéuticos, y en cumplimiento de la Ley General de Sanidad en
          relación con la Ley Orgánica 1/1982.
        </p>

        <p>
          Yo, D/Doña. {campo('nombrePaciente', { placeholder: 'Nombre del paciente *', ancho: 'lg' })} como
          paciente o (D/Doña como su representante),{' '}
          {campo('nombreRepresentante', { placeholder: 'Representante (opcional)', ancho: 'lg' })} en pleno uso
          de mis facultades, libre y voluntariamente, DECLARO que he sido debidamente INFORMADO/A, por el Dr.{' '}
          {campo('nombreDoctor', { placeholder: 'Nombre del doctor *', ancho: 'lg' })}, y en consecuencia,
          AUTORIZO a <span className="consent-eco">{doctor || '…'}</span> para que me sea realizado el
          procedimiento diagnóstico/terapéutico denominado{' '}
          {campo('procedimiento', { placeholder: 'Procedimiento *', ancho: 'xl' })} o cualquier otro
          procedimiento que estime necesario para completar el tratamiento previsto.
        </p>

        <p>Me doy por enterado/a de los siguientes puntos relativos a dicho procedimiento:</p>

        <p>
          La cirugía oral se hace necesaria para el tratamiento de muy diversas problemas y patologías de la
          cavidad oral. Entre dichas patologías se encuentran los terceros molares o muelas del juicio incluidas
          superiores e inferiores así como quistes u otras entidades relacionadas. La causa más frecuente de
          inclusión de estos dientes es la falta de espacio en la arcada y en casos más excepcionales la
          presencia de patologías asociadas. La intervención puede realizarse con anestesia general o local con
          el riesgo inherente asociado a la misma, que serán informados por su anestesista, y los fármacos
          utilizados pueden producir determinadas alteraciones del nivel de conciencia por lo que no podré
          realizar determinadas actividades inmediatamente, tales como conducir un vehículo.
        </p>

        <p>
          Todos estos procedimientos tienen el fin de conseguir un indudable beneficio, sin embargo, no están
          exentos de complicaciones, algunas de ellas inevitables en casos excepcionales, siendo las
          estadísticamente más frecuentes:
        </p>

        <ul className="consent-lista">
          {COMPLICACIONES.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <div className="consent-bloque">
          <span>Riesgos específicos en mi caso y otras complicaciones de mínima relevancia estadística</span>
          {area('riesgosEspecificos', 'Riesgos específicos (opcional)')}
        </div>

        <p>
          Recibida la anterior información, considero que he comprendido la naturaleza y propósitos del
          procedimiento <span className="consent-eco">{procedimiento || '…'}</span>. Además en entrevista
          personal con el Dr <span className="consent-eco">{doctor || '…'}</span> he sido informado/a, en
          términos que he comprendido, del alcance de dicho tratamiento. En la entrevista he tenido la
          oportunidad de proponer y resolver mis posibles dudas, y de obtener cuanta información complementaria
          he creído necesaria. Por ello, me considero en condiciones de sopesar debidamente tanto sus posibles
          riesgos como la utilidad y beneficios que de él puedo obtener.
        </p>

        <p>
          Estoy satisfecho/a con la información que se me ha proporcionado y, por ello,{' '}
          <strong>DOY MI CONSENTIMIENTO</strong> para que se me practique{' '}
          <span className="consent-eco">{procedimiento || '…'}</span>.
        </p>

        <p>
          Este consentimiento puede ser revocado por mí sin necesidad de justificación alguna, en cualquier
          momento antes de realizar el procedimiento.
        </p>

        <div className="consent-bloque">
          <span>Observaciones</span>
          {area('observaciones', 'Observaciones (opcional)')}
        </div>

        <p>
          Y, para que así conste, firmo el presente original <strong>después de leído</strong>, por duplicado,
          cuya copia se me proporciona.
        </p>

        <p>
          En {campo('lugar', { placeholder: 'Lugar', ancho: 'sm' })} a fecha{' '}
          {campo('fechaConsentimiento', { placeholder: 'Fecha *', ancho: 'sm', tipo: 'date' })}
        </p>

        <div className="consent-firmas">
          <div className="consent-firma">
            <div className="consent-firma-linea" />
            <span>Firma del paciente</span>
            <span>(o su representante legal en caso de incapacidad).</span>
            <span className="consent-firma-dato">
              DPI {campo('documentoPaciente', { placeholder: 'Número de DPI *', ancho: 'sm' })}
            </span>
          </div>
          <div className="consent-firma">
            <div className="consent-firma-linea" />
            <span>Firma del médico</span>
            <span>Dr. {doctor || '…'}</span>
            <span className="consent-firma-dato">
              Nº de colegiado {campo('colegiadoDoctor', { placeholder: 'Colegiado', ancho: 'sm' })}
            </span>
          </div>
          <div className="consent-firma consent-firma-testigo">
            <div className="consent-firma-linea" />
            <span>En caso de negativa por parte del paciente a firmar el consentimiento</span>
            <span>Firma del testigo (DPI)</span>
          </div>
        </div>
      </div>

      {guardado?.impresiones?.length > 0 && (
        <div className="consent-impresiones">
          <div className="consent-impresiones-titulo">Registro de impresiones</div>
          <ul>
            {guardado.impresiones.map((imp, i) => (
              <li key={`${imp.fechaImpresion}-${i}`}>
                {formatDate(imp.fechaImpresion)} · {formatTime(imp.fechaImpresion)} — {imp.usuario || '—'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ConsentimientoForm;
