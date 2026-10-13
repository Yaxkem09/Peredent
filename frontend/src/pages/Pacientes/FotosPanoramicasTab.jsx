import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { panoramicasService } from '../../services/panoramicas.service';
import { Alert, Button, EmptyState, Loader, Modal } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import VisorDocumento from './VisorDocumento';
import './FotosPanoramicasTab.css';

// SCRUM-42: subida y visualización de fotos panorámicas. El backend (Yax,
// PR #42) valida tipo/tamaño por magic bytes; esta validación en el cliente
// es solo para UX, no reemplaza la del servidor.
// Se pueden elegir varias fotos a la vez: el backend recibe una por petición, así
// que se suben una tras otra y al final se informa cuáles fallaron.
// Además de imágenes se aceptan documentos Word (.docx): no se ven en el visor,
// se descargan. Se valida por extensión porque algunos navegadores no informan
// el tipo de un .docx.
const TAMANO_MAXIMO_BYTES = 15 * 1024 * 1024;
const EXTENSIONES_PERMITIDAS = ['jpg', 'jpeg', 'png', 'docx'];
const ACCEPT = '.jpg,.jpeg,.png,.docx,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const extensionDe = (nombre) => (nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : '');
const esDocumento = (archivo) => archivo.tipo === 'documento';

const IconUpload = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const IconImage = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
);

const IconDocumento = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 12.5l1.2 4.5 1.3-3.5 1.3 3.5 1.2-4.5" />
  </svg>
);

const IconDescargar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconRefresh = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconX = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const IconZoom = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
  </svg>
);

const IconFlecha = ({ direccion }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {direccion === 'izquierda' ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
  </svg>
);

const IconExterno = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </svg>
);

const IconAlerta = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

// Las fechas de subida llegan en UTC (con "Z"): se muestran siempre en hora de
// Guatemala, sin depender de la zona horaria de la computadora.
const ZONA_GT = 'America/Guatemala';

const formatDate = (valor) =>
  new Date(valor).toLocaleDateString('es-GT', { timeZone: ZONA_GT, day: '2-digit', month: '2-digit', year: 'numeric' });

const formatTime = (valor) =>
  new Date(valor).toLocaleTimeString('es-GT', { timeZone: ZONA_GT, hour: 'numeric', minute: '2-digit', hour12: true });

// Día de calendario en Guatemala (AAAA-MM-DD), para agrupar la galería.
const claveDia = (valor) => new Date(valor).toLocaleDateString('en-CA', { timeZone: ZONA_GT });

const tituloDia = (clave) => {
  const hoy = claveDia(new Date());
  const ayer = claveDia(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (clave === hoy) return 'Hoy';
  if (clave === ayer) return 'Ayer';
  const [anio, mes, dia] = clave.split('-').map(Number);
  const texto = new Date(anio, mes - 1, dia).toLocaleDateString('es-GT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Agrupa los archivos (ya ordenados del más reciente al más antiguo) por día.
// `indice` es la posición entre las imágenes, para abrir el visor en la foto
// correcta; los documentos no van al visor (indice null).
const agruparPorDia = (fotos) => {
  const grupos = [];
  let indiceImagen = 0;
  fotos.forEach((foto) => {
    const indice = esDocumento(foto) ? null : indiceImagen++;
    const clave = claveDia(foto.fechaSubida);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === clave) ultimo.fotos.push({ foto, indice });
    else grupos.push({ clave, fotos: [{ foto, indice }] });
  });
  return grupos;
};

const IconCalendario = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);

const IconReloj = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const validarArchivo = (file) => {
  if (!EXTENSIONES_PERMITIDAS.includes(extensionDe(file.name))) {
    return 'Solo se permiten imágenes JPG o PNG y documentos Word (.docx).';
  }
  if (file.size > TAMANO_MAXIMO_BYTES) {
    return 'Supera el tamaño máximo permitido (15 MB).';
  }
  return null;
};

const formatearTamano = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

let siguienteIdSeleccion = 0;

// Visor a pantalla completa: flechas (o teclado) para pasar entre fotos, clic en
// la imagen para verla a tamaño real y Esc para cerrar.
const VisorPanoramica = ({ fotos, indice, onCambiar, onCerrar }) => {
  const [zoom, setZoom] = useState(false);
  const foto = fotos[indice];
  const hayVarias = fotos.length > 1;

  const anterior = useCallback(() => {
    setZoom(false);
    onCambiar((indice - 1 + fotos.length) % fotos.length);
  }, [indice, fotos.length, onCambiar]);

  const siguiente = useCallback(() => {
    setZoom(false);
    onCambiar((indice + 1) % fotos.length);
  }, [indice, fotos.length, onCambiar]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCerrar();
      else if (e.key === 'ArrowLeft' && hayVarias) anterior();
      else if (e.key === 'ArrowRight' && hayVarias) siguiente();
    };
    document.addEventListener('keydown', onKeyDown);
    // Sin scroll de fondo mientras el visor está abierto.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar, anterior, siguiente, hayVarias]);

  if (!foto) return null;

  return createPortal(
    <div className="visor-overlay" role="dialog" aria-modal="true" aria-label="Vista de la foto panorámica" onMouseDown={onCerrar}>
      <div className="visor-barra" onMouseDown={(e) => e.stopPropagation()}>
        <span className="visor-info">
          {formatDate(foto.fechaSubida)} · {formatTime(foto.fechaSubida)}
          {hayVarias && <span className="visor-contador">{indice + 1} / {fotos.length}</span>}
        </span>
        <div className="visor-acciones">
          <button
            type="button"
            className="visor-boton"
            onClick={() => setZoom((valor) => !valor)}
            title={zoom ? 'Ajustar a la pantalla' : 'Ver a tamaño real'}
            aria-label={zoom ? 'Ajustar a la pantalla' : 'Ver a tamaño real'}
          >
            <IconZoom />
          </button>
          <a
            className="visor-boton"
            href={foto.urlFirmada}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en una pestaña nueva"
            aria-label="Abrir en una pestaña nueva"
          >
            <IconExterno />
          </a>
          <button type="button" className="visor-boton" onClick={onCerrar} title="Cerrar (Esc)" aria-label="Cerrar">
            <IconX size={18} />
          </button>
        </div>
      </div>

      <div className={`visor-escenario${zoom ? ' con-zoom' : ''}`}>
        <img
          key={foto.id}
          src={foto.urlFirmada}
          alt={`Foto panorámica del ${formatDate(foto.fechaSubida)}`}
          className="visor-imagen"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setZoom((valor) => !valor)}
        />
      </div>

      {hayVarias && (
        <>
          <button
            type="button"
            className="visor-nav izquierda"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={anterior}
            aria-label="Foto anterior"
          >
            <IconFlecha direccion="izquierda" />
          </button>
          <button
            type="button"
            className="visor-nav derecha"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={siguiente}
            aria-label="Foto siguiente"
          >
            <IconFlecha direccion="derecha" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
};

const FotosPanoramicasTab = ({ idPaciente }) => {
  const { user } = useAuth();
  // La asistente sube y consulta, pero solo el odontólogo elimina (el backend exige lo mismo).
  const puedeEliminar = user?.rol === 'Odontologo';
  const [fotos, setFotos] = useState([]);
  // El visor solo recorre imágenes.
  const imagenes = fotos.filter((f) => !esDocumento(f));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Cada elemento: { id, file, url, error }. Los que traen error no se suben.
  const [seleccion, setSeleccion] = useState([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState({ hechas: 0, total: 0 });
  const [errorSubida, setErrorSubida] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  const [fotoAEliminar, setFotoAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const [indiceVisor, setIndiceVisor] = useState(null);
  const [documentoVisor, setDocumentoVisor] = useState(null);
  const cerrarDocumento = useCallback(() => setDocumentoVisor(null), []);

  const inputRef = useRef(null);
  // Para revocar las URLs de vista previa al desmontar la pestaña.
  const seleccionRef = useRef(seleccion);
  seleccionRef.current = seleccion;

  const cargarFotos = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await panoramicasService.getByPaciente(idPaciente);
      setFotos(data);
    } catch {
      setError('No se pudieron cargar los archivos de este paciente.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    panoramicasService
      .getByPaciente(idPaciente)
      .then((data) => {
        if (activo) setFotos(data);
      })
      .catch(() => {
        if (activo) setError('No se pudieron cargar los archivos de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  useEffect(() => () => seleccionRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const limpiarSeleccion = () => {
    seleccion.forEach((item) => URL.revokeObjectURL(item.url));
    setSeleccion([]);
    setErrorSubida(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const agregarArchivos = (lista) => {
    const archivos = Array.from(lista ?? []);
    if (archivos.length === 0) return;

    setMensajeExito(null);
    setErrorSubida(null);
    setSeleccion((prev) => [
      ...prev,
      ...archivos.map((file) => ({
        id: ++siguienteIdSeleccion,
        file,
        url: URL.createObjectURL(file),
        esDocumento: extensionDe(file.name) === 'docx',
        error: validarArchivo(file),
      })),
    ]);
    // Se limpia el input para poder volver a elegir los mismos archivos.
    if (inputRef.current) inputRef.current.value = '';
  };

  const quitarDeSeleccion = (id) => {
    setSeleccion((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((s) => s.id !== id);
    });
  };

  const validas = seleccion.filter((item) => !item.error);
  const invalidas = seleccion.length - validas.length;

  const subir = async () => {
    if (validas.length === 0) return;

    setSubiendo(true);
    setErrorSubida(null);
    setMensajeExito(null);
    setProgreso({ hechas: 0, total: validas.length });

    const fallidas = [];
    let subidas = 0;
    for (const item of validas) {
      try {
        await panoramicasService.subir(idPaciente, item.file);
        subidas += 1;
        quitarDeSeleccion(item.id);
      } catch (err) {
        fallidas.push(item.file.name);
        const mensaje = err?.response?.data?.message || 'No se pudo subir.';
        setSeleccion((prev) => prev.map((s) => (s.id === item.id ? { ...s, error: mensaje } : s)));
      }
      setProgreso((prev) => ({ ...prev, hechas: prev.hechas + 1 }));
    }

    setSubiendo(false);
    if (subidas > 0) {
      setMensajeExito(
        subidas === 1 ? 'Se guardó 1 archivo correctamente.' : `Se guardaron ${subidas} archivos correctamente.`,
      );
      await cargarFotos();
    }
    if (fallidas.length > 0) {
      setErrorSubida(`No se pudieron subir ${fallidas.length} archivo(s): ${fallidas.join(', ')}.`);
    }
  };

  const confirmarEliminar = async () => {
    if (!fotoAEliminar) return;

    setEliminando(true);
    try {
      await panoramicasService.eliminar(fotoAEliminar.id);
      setFotos((prev) => prev.filter((f) => f.id !== fotoAEliminar.id));
      setFotoAEliminar(null);
    } catch {
      setFotoAEliminar(null);
      setError('No se pudo eliminar el archivo. Intenta de nuevo.');
    } finally {
      setEliminando(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setArrastrando(false);
    if (!subiendo) agregarArchivos(e.dataTransfer.files);
  };

  const grupos = agruparPorDia(fotos);

  return (
    <div className="panoramicas">
      <div className="panoramicas-header">
        <div>
          <h2 className="panoramicas-titulo">Radiografías y panorámicas</h2>
          <p className="panoramicas-subtitulo">
            {fotos.length === 0
              ? 'Sube aquí las radiografías, fotos panorámicas y documentos Word del paciente.'
              : `${fotos.length} ${fotos.length === 1 ? 'archivo guardado' : 'archivos guardados'} · haz clic en una imagen para verla en grande`}
          </p>
        </div>
        <button type="button" className="btn btn-outline-teal btn-md" onClick={cargarFotos} disabled={cargando}>
          <IconRefresh /> Refrescar
        </button>
      </div>

      <div className="panoramicas-subida">
        <label
          className={`panoramicas-dropzone${arrastrando ? ' arrastrando' : ''}${subiendo ? ' deshabilitada' : ''}${seleccion.length > 0 ? ' compacta' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!subiendo) setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(e) => agregarArchivos(e.target.files)}
            disabled={subiendo}
          />
          <span className="panoramicas-dropzone-icono">
            <IconUpload size={22} />
          </span>
          <span className="panoramicas-dropzone-textos">
            <span className="panoramicas-dropzone-titulo">
              {seleccion.length > 0 ? 'Agregar más archivos' : 'Haz clic o arrastra aquí las radiografías o documentos'}
            </span>
            <span className="panoramicas-dropzone-ayuda">Puedes elegir varios a la vez · JPG, PNG o Word (.docx) · máximo 15 MB cada uno</span>
          </span>
        </label>

        {seleccion.length > 0 && (
          <div className="panoramicas-seleccion">
            <div className="panoramicas-seleccion-head">
              {seleccion.length === 1 ? '1 archivo seleccionado' : `${seleccion.length} archivos seleccionados`}
              {invalidas > 0 && ` · ${invalidas} con error (no se subirán)`}
            </div>
            <div className="panoramicas-seleccion-grid">
              {seleccion.map((item) => (
                <div className={`panoramicas-seleccion-item${item.error ? ' con-error' : ''}`} key={item.id}>
                  {item.esDocumento ? (
                    <div className="panoramicas-seleccion-doc">
                      <IconDocumento size={28} />
                    </div>
                  ) : (
                    <img src={item.url} alt={item.file.name} />
                  )}
                  <button
                    type="button"
                    className="panoramicas-seleccion-quitar"
                    onClick={() => quitarDeSeleccion(item.id)}
                    disabled={subiendo}
                    aria-label={`Quitar ${item.file.name}`}
                    title="Quitar"
                  >
                    <IconX />
                  </button>
                  <div className="panoramicas-seleccion-pie">
                    <span className="panoramicas-seleccion-nombre" title={item.file.name}>{item.file.name}</span>
                    <span className="panoramicas-seleccion-detalle">{item.error ?? formatearTamano(item.file.size)}</span>
                  </div>
                </div>
              ))}
            </div>

            {subiendo && (
              <div className="panoramicas-progreso" role="status">
                <div className="panoramicas-progreso-barra">
                  <span style={{ width: `${progreso.total ? (progreso.hechas / progreso.total) * 100 : 0}%` }} />
                </div>
                <span>
                  Subiendo {Math.min(progreso.hechas + 1, progreso.total)} de {progreso.total}…
                </span>
              </div>
            )}

            <div className="panoramicas-subida-acciones">
              <button type="button" className="btn btn-secondary btn-md" onClick={limpiarSeleccion} disabled={subiendo}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-md"
                onClick={subir}
                disabled={validas.length === 0 || subiendo}
              >
                <IconUpload />{' '}
                {subiendo
                  ? 'Subiendo…'
                  : validas.length === 1
                    ? 'Guardar 1 archivo'
                    : `Guardar ${validas.length} archivos`}
              </button>
            </div>
          </div>
        )}

        {errorSubida && <Alert type="error">{errorSubida}</Alert>}
        {mensajeExito && <Alert type="success">{mensajeExito}</Alert>}
      </div>

      {cargando ? (
        <Loader />
      ) : error ? (
        <Alert type="error">{error}</Alert>
      ) : fotos.length === 0 ? (
        <EmptyState
          icon={<IconImage />}
          title="Sin archivos"
          description="Aún no se han subido radiografías, fotos panorámicas ni documentos para este paciente."
        />
      ) : (
        <div className="panoramicas-galeria">
          {grupos.map((grupo) => (
            <section className="panoramicas-grupo" key={grupo.clave}>
              <h3 className="panoramicas-grupo-titulo">
                <IconCalendario />
                {tituloDia(grupo.clave)}
                <span className="panoramicas-grupo-contador">{grupo.fotos.length}</span>
              </h3>
              <div className="panoramicas-grid">
                {grupo.fotos.map(({ foto, indice }) => (
                  <div className="panoramicas-item" key={foto.id}>
                    {esDocumento(foto) ? (
                      <button
                        type="button"
                        className="panoramicas-item-doc"
                        onClick={() => setDocumentoVisor(foto)}
                        aria-label={`Ver el documento del ${formatDate(foto.fechaSubida)}`}
                      >
                        <IconDocumento size={44} />
                        <span className="panoramicas-item-doc-nombre">Documento Word</span>
                        <span className="panoramicas-item-overlay">
                          <IconZoom /> Vista previa
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="panoramicas-item-ver"
                        onClick={() => setIndiceVisor(indice)}
                        aria-label={`Ver en grande la imagen del ${formatDate(foto.fechaSubida)}`}
                      >
                        <img src={foto.urlFirmada} alt={`Radiografía del ${formatDate(foto.fechaSubida)}`} loading="lazy" />
                        <span className="panoramicas-item-overlay">
                          <IconZoom /> Ver en grande
                        </span>
                      </button>
                    )}
                    <div className="panoramicas-item-pie">
                      <div className="panoramicas-item-datos">
                        <span className="panoramicas-item-fecha">
                          <IconCalendario /> {formatDate(foto.fechaSubida)}
                        </span>
                        <span className="panoramicas-item-hora">
                          <IconReloj /> {formatTime(foto.fechaSubida)}
                        </span>
                      </div>
                      {esDocumento(foto) && (
                        // El enlace firmado ya fuerza la descarga del archivo.
                        <a
                          className="panoramicas-item-eliminar panoramicas-item-descargar"
                          href={foto.urlFirmada}
                          aria-label="Descargar documento"
                          title="Descargar"
                        >
                          <IconDescargar />
                        </a>
                      )}
                      {puedeEliminar && (
                        <button
                          type="button"
                          className="panoramicas-item-eliminar"
                          onClick={() => setFotoAEliminar(foto)}
                          aria-label={esDocumento(foto) ? 'Eliminar documento' : 'Eliminar imagen'}
                          title="Eliminar"
                        >
                          <IconTrash />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {indiceVisor !== null && (
        <VisorPanoramica
          fotos={imagenes}
          indice={indiceVisor}
          onCambiar={setIndiceVisor}
          onCerrar={() => setIndiceVisor(null)}
        />
      )}

      {documentoVisor && (
        <VisorDocumento
          documento={documentoVisor}
          titulo={`Documento Word · ${formatDate(documentoVisor.fechaSubida)} · ${formatTime(documentoVisor.fechaSubida)}`}
          onCerrar={cerrarDocumento}
        />
      )}

      <Modal
        open={Boolean(fotoAEliminar)}
        onClose={() => !eliminando && setFotoAEliminar(null)}
        icon={<IconAlerta />}
        title={fotoAEliminar && esDocumento(fotoAEliminar) ? '¿Eliminar este documento?' : '¿Eliminar esta imagen?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFotoAEliminar(null)} disabled={eliminando}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarEliminar} loading={eliminando}>
              Sí, eliminar
            </Button>
          </>
        }
      >
        {fotoAEliminar && (
          <div className="panoramicas-confirmar">
            {esDocumento(fotoAEliminar) ? (
              <div className="panoramicas-confirmar-doc">
                <IconDocumento size={26} />
                <span>Documento Word</span>
              </div>
            ) : (
              <img src={fotoAEliminar.urlFirmada} alt="Foto panorámica a eliminar" />
            )}
            <p>
              Se eliminará {esDocumento(fotoAEliminar) ? 'el documento subido' : 'la imagen subida'} el {formatDate(fotoAEliminar.fechaSubida)} a las{' '}
              {formatTime(fotoAEliminar.fechaSubida)}. Esta acción no se puede deshacer.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FotosPanoramicasTab;
