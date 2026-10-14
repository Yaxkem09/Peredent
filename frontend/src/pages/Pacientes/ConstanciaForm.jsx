import { useState } from 'react';
import { constanciasService } from '../../services/constancias.service';
import { Alert, Button, Modal } from '../../components/common';
import { IconBack, IconPrinter } from '../Recetario/RecetarioIcons';
import { abrirPdfConstancia } from './constanciaPdf';
import logo from '../../assets/logo.png';
import './Consentimientos.css';
import './Constancias.css';

const TIPO_EXTRACCION = 'Extracción de terceras molares';
const DIAS_REPOSO_MAXIMO = 90;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const NOMBRES_CAMPO = {
  fechaAtencion: 'Fecha de atención',
  diasReposo: 'Días de reposo',
  tratamientoRealizado: 'Tratamiento realizado',
  lugarEmision: 'Lugar de emisión',
};

// Fecha de hoy como "yyyy-mm-dd" en hora local (no UTC), para el input date.
const hoyLocal = () => {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

// "yyyy-mm-dd" → "26 de julio de 2025"
const fechaLarga = (iso) => {
  const [anio, mes, dia] = (iso || '').split('-').map(Number);
  if (!anio || !mes || !dia) return '';
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
};

// Igual que ConstanciaPdfService.Articulo: concordancia según el sexo
// registrado, o la forma neutra de la plantilla si no hay.
const articulos = (sexo) => {
  if (sexo === 'Femenino') return { paciente: 'la paciente', atendido: 'atendida', interesado: 'de la interesada' };
  if (sexo === 'Masculino') return { paciente: 'el paciente', atendido: 'atendido', interesado: 'del interesado' };
  return { paciente: 'el/la paciente', atendido: 'atendido(a)', interesado: 'del/de la interesado(a)' };
};

const textoDias = (dias) => (Number(dias) === 1 ? '1 día' : `${dias} días`);

// SCRUM-294/296: formulario de la constancia con el texto fijo de la plantilla
// elegida y los campos variables en su lugar. El texto debe coincidir con
// backend/Services/ConstanciaPdfService.cs, que es el que se imprime.
// SCRUM-302: se emite una sola vez; no hay guardado como borrador ni edición.
const ConstanciaForm = ({ idPaciente, paciente, tipo, doctor, lugarInicial, onEmitida, onVolver }) => {
  const esExtraccion = tipo.nombre === TIPO_EXTRACCION;
  const [form, setForm] = useState({
    fechaAtencion: hoyLocal(),
    diasReposo: esExtraccion ? '3' : '0',
    tratamientoRealizado: '',
    lugarEmision: lugarInicial,
  });
  const [invalidos, setInvalidos] = useState([]);
  const [error, setError] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);

  const art = articulos(paciente?.sexo);
  const nombrePaciente = paciente ? `${paciente.nombres} ${paciente.apellidos}`.trim() : '';
  const nombreDoctor = doctor ? `${doctor.nombres} ${doctor.apellidos}`.trim() : '';
  const dias = Number(form.diasReposo);
  const conReposo = form.diasReposo !== '' && dias > 0;

  const cambiar = (campo) => (e) => {
    const valor = e.target.value;
    setForm((f) => ({ ...f, [campo]: valor }));
    if (invalidos.includes(campo)) {
      setInvalidos((prev) => prev.filter((c) => c !== campo));
    }
  };

  const validar = () => {
    const faltantes = [];
    if (!form.fechaAtencion) faltantes.push('fechaAtencion');
    if (form.diasReposo === '') faltantes.push('diasReposo');
    if (!esExtraccion && !form.tratamientoRealizado.trim()) faltantes.push('tratamientoRealizado');

    if (faltantes.length > 0) {
      setInvalidos(faltantes);
      setError(`Falta completar: ${faltantes.map((c) => NOMBRES_CAMPO[c]).join(', ')}.`);
      return false;
    }
    if (form.fechaAtencion > hoyLocal()) {
      setInvalidos(['fechaAtencion']);
      setError('La fecha de atención no puede ser posterior a hoy.');
      return false;
    }
    if (!Number.isInteger(dias) || dias < 0 || dias > DIAS_REPOSO_MAXIMO) {
      setInvalidos(['diasReposo']);
      setError(`Los días de reposo deben ser un número entero entre 0 y ${DIAS_REPOSO_MAXIMO}.`);
      return false;
    }
    setInvalidos([]);
    setError(null);
    return true;
  };

  const pedirConfirmacion = () => {
    if (validar()) setConfirmando(true);
  };

  // Emite la constancia y abre el PDF para imprimirla. La pestaña se abre en
  // el clic de "Emitir" para que el navegador no la bloquee.
  const emitir = async () => {
    const ventana = window.open('', '_blank');
    setEmitiendo(true);
    setError(null);

    let dto;
    try {
      dto = await constanciasService.crear(idPaciente, {
        idTipoConstanciaMedica: tipo.idTipoConstancia,
        fechaAtencion: form.fechaAtencion,
        diasReposo: dias,
        tratamientoRealizado: esExtraccion ? null : form.tratamientoRealizado,
        lugarEmision: form.lugarEmision,
      });
    } catch (err) {
      ventana?.close();
      const campos = err.response?.data?.campos;
      if (Array.isArray(campos)) setInvalidos(campos);
      setError(err.response?.data?.message || 'No se pudo emitir la constancia. Intenta de nuevo.');
      setEmitiendo(false);
      setConfirmando(false);
      return;
    }

    try {
      await abrirPdfConstancia(idPaciente, dto.idConstancia, ventana);
    } catch {
      // La constancia ya quedó emitida; se puede abrir desde la lista.
    }
    setEmitiendo(false);
    setConfirmando(false);
    onEmitida(dto);
  };

  const claseInvalido = (campo) => (invalidos.includes(campo) ? ' invalido' : '');

  return (
    <div className="consent">
      <div className="receta-doc-acciones">
        <div className="receta-doc-acciones-grupo">
          <button type="button" className="btn btn-secondary btn-md" onClick={onVolver} disabled={emitiendo}>
            <IconBack /> Cambiar tipo de constancia
          </button>
          <span className="tag tag-pending consent-estado">{tipo.nombre}</span>
        </div>
        <div className="receta-doc-acciones-grupo">
          <button type="button" className="btn btn-primary btn-md" onClick={pedirConfirmacion} disabled={emitiendo}>
            <IconPrinter /> Emitir constancia
          </button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="consent-doc constancia-doc">
        <div className="constancia-logo">
          <img src={logo} alt="Peredent" />
        </div>

        <h3 className="constancia-titulo">CONSTANCIA ODONTOLÓGICA</h3>

        <p className="consent-nota">
          Completa los campos resaltados. Una vez emitida, la constancia no se puede editar: si tiene un error,
          emite una nueva.
        </p>

        <p>
          Por medio de la presente, se hace constar que {art.paciente} <strong>{nombrePaciente}</strong>, fue{' '}
          {art.atendido} en esta clínica el día{' '}
          <input
            type="date"
            className={`consent-input consent-input-sm${claseInvalido('fechaAtencion')}`}
            value={form.fechaAtencion}
            max={hoyLocal()}
            onChange={cambiar('fechaAtencion')}
            aria-label="Fecha de atención"
            disabled={emitiendo}
          />
          {esExtraccion ? (
            <>
              , para la realización de un procedimiento quirúrgico de{' '}
              <strong>extracción de tercera(s) molar(es)</strong>.
            </>
          ) : (
            ', para la realización de un procedimiento odontológico consistente en:'
          )}
        </p>

        {!esExtraccion && (
          <div className="consent-bloque constancia-tratamiento">
            <strong>Tratamiento realizado:</strong>
            <textarea
              className={`consent-textarea${claseInvalido('tratamientoRealizado')}`}
              rows={3}
              value={form.tratamientoRealizado}
              onChange={cambiar('tratamientoRealizado')}
              placeholder="Describe el tratamiento realizado *"
              maxLength={1000}
              aria-label="Tratamiento realizado"
              disabled={emitiendo}
            />
          </div>
        )}

        {esExtraccion ? (
          <p>
            Debido a la naturaleza del procedimiento realizado, se recomienda reposo relativo durante un período
            de{' '}
            <input
              type="number"
              min={0}
              max={DIAS_REPOSO_MAXIMO}
              className={`consent-input constancia-input-dias${claseInvalido('diasReposo')}`}
              value={form.diasReposo}
              onChange={cambiar('diasReposo')}
              aria-label="Días de reposo"
              disabled={emitiendo}
            />{' '}
            día(s), a partir de la fecha indicada, así como evitar actividades físicas intensas y seguir las
            indicaciones postoperatorias proporcionadas.
          </p>
        ) : (
          <p>
            La atención odontológica se llevó a cabo en la fecha y horario correspondientes. Debido a la naturaleza
            del procedimiento realizado, se recomienda reposo relativo durante un período de{' '}
            <input
              type="number"
              min={0}
              max={DIAS_REPOSO_MAXIMO}
              className={`consent-input constancia-input-dias${claseInvalido('diasReposo')}`}
              value={form.diasReposo}
              onChange={cambiar('diasReposo')}
              aria-label="Días de reposo"
              disabled={emitiendo}
            />{' '}
            día(s).
          </p>
        )}
        {!conReposo && (
          <p className="constancia-ayuda">
            Con 0 días de reposo, la frase de reposo no aparece en la constancia impresa.
          </p>
        )}

        <p>
          Se extiende la presente constancia a solicitud {art.interesado}, para los usos que estime convenientes.
        </p>

        <p>
          Lugar y fecha de emisión:{' '}
          <input
            type="text"
            className={`consent-input consent-input-md${claseInvalido('lugarEmision')}`}
            value={form.lugarEmision}
            onChange={cambiar('lugarEmision')}
            placeholder="Lugar (ej. Santa Cruz del Quiché)"
            maxLength={100}
            aria-label="Lugar de emisión"
            disabled={emitiendo}
          />
          , <strong>{fechaLarga(hoyLocal())}</strong>
        </p>

        <p>Atentamente,</p>

        <div className="constancia-firma">
          <div className="consent-firma-linea" />
          <strong>Dr. {nombreDoctor || '…'}</strong>
          <span>{esExtraccion ? 'Cirujano Oral y Maxilofacial' : 'Odontólogo(a)'}</span>
          <span>Colegiado No. {doctor?.colegiado || '—'}</span>
          <span>Teléfono: {doctor?.telefono || '—'}</span>
          <span className="constancia-firma-sello">Firma y sello profesional</span>
        </div>
      </div>

      <Modal
        open={confirmando}
        onClose={() => !emitiendo && setConfirmando(false)}
        title="¿Emitir constancia?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmando(false)} disabled={emitiendo}>
              Revisar
            </Button>
            <Button variant="primary" onClick={emitir} loading={emitiendo}>
              Emitir e imprimir
            </Button>
          </>
        }
      >
        <p>
          Una vez emitida, la constancia <strong>no se puede editar</strong>. Si tiene un error, deberás emitir
          una nueva. ¿Confirmas que los datos son correctos?
        </p>
      </Modal>
    </div>
  );
};

export default ConstanciaForm;
