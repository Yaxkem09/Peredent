import { useEffect, useRef, useState } from 'react';
import { panoramicasService } from '../../services/panoramicas.service';
import { Alert, EmptyState, Loader } from '../../components/common';
import { formatDate, formatTime } from '../../utils/formatters';
import './FotosPanoramicasTab.css';

// SCRUM-42: subida y visualización de fotos panorámicas. El backend (Yax,
// PR #42) valida tipo/tamaño por magic bytes; esta validación en el cliente
// es solo para UX, no reemplaza la del servidor.
const TAMANO_MAXIMO_BYTES = 15 * 1024 * 1024;
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png'];

const IconUpload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

const IconRefresh = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const validarArchivo = (file) => {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return 'Solo se permiten archivos JPG o PNG.';
  }
  if (file.size > TAMANO_MAXIMO_BYTES) {
    return 'El archivo supera el tamaño máximo permitido (15 MB).';
  }
  return null;
};

const FotosPanoramicasTab = ({ idPaciente }) => {
  const [fotos, setFotos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [archivo, setArchivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState(null);
  const [subidaExitosa, setSubidaExitosa] = useState(false);

  const [eliminandoId, setEliminandoId] = useState(null);

  const inputRef = useRef(null);

  const cargarFotos = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await panoramicasService.getByPaciente(idPaciente);
      setFotos(data);
    } catch {
      setError('No se pudieron cargar las fotos panorámicas de este paciente.');
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
        if (activo) setError('No se pudieron cargar las fotos panorámicas de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const limpiarSeleccion = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setArchivo(null);
    setPreviewUrl(null);
    setErrorArchivo(null);
    setErrorSubida(null);
    setSubidaExitosa(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const seleccionarArchivo = (file) => {
    setSubidaExitosa(false);
    setErrorSubida(null);

    if (!file) {
      limpiarSeleccion();
      return;
    }

    const mensajeError = validarArchivo(file);
    if (mensajeError) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setArchivo(null);
      setPreviewUrl(null);
      setErrorArchivo(mensajeError);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setArchivo(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorArchivo(null);
  };

  const subir = async () => {
    if (!archivo) return;
    setSubiendo(true);
    setErrorSubida(null);
    try {
      await panoramicasService.subir(idPaciente, archivo);
      limpiarSeleccion();
      setSubidaExitosa(true);
      await cargarFotos();
    } catch {
      setErrorSubida('No se pudo subir la foto panorámica. Intenta de nuevo.');
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = async (foto) => {
    if (!window.confirm('¿Eliminar esta foto panorámica? Esta acción no se puede deshacer.')) return;

    setEliminandoId(foto.id);
    try {
      await panoramicasService.eliminar(foto.id);
      setFotos((prev) => prev.filter((f) => f.id !== foto.id));
    } catch {
      setError('No se pudo eliminar la foto panorámica. Intenta de nuevo.');
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div className="panoramicas">
      <div className="panoramicas-subida">
        <div className="panoramicas-subida-campo">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => seleccionarArchivo(e.target.files?.[0] ?? null)}
            disabled={subiendo}
          />
          {previewUrl && (
            <div className="panoramicas-preview">
              <img src={previewUrl} alt="Vista previa de la foto seleccionada" />
            </div>
          )}
        </div>

        {errorArchivo && <Alert type="error">{errorArchivo}</Alert>}
        {errorSubida && <Alert type="error">{errorSubida}</Alert>}
        {subidaExitosa && <Alert type="success">Foto panorámica subida correctamente.</Alert>}

        <div className="panoramicas-subida-acciones">
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={subir}
            disabled={!archivo || subiendo}
          >
            <IconUpload /> {subiendo ? 'Subiendo…' : 'Subir foto'}
          </button>
          {archivo && (
            <button type="button" className="btn btn-secondary btn-md" onClick={limpiarSeleccion} disabled={subiendo}>
              Cancelar
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline-teal btn-md panoramicas-refrescar"
            onClick={cargarFotos}
            disabled={cargando}
          >
            <IconRefresh /> Refrescar
          </button>
        </div>
      </div>

      {cargando ? (
        <Loader />
      ) : error ? (
        <Alert type="error">{error}</Alert>
      ) : fotos.length === 0 ? (
        <EmptyState
          icon={<IconImage />}
          title="Sin fotos panorámicas"
          description="Aún no se han subido fotos panorámicas para este paciente."
        />
      ) : (
        <div className="panoramicas-grid">
          {fotos.map((foto) => (
            <div className="panoramicas-item" key={foto.id}>
              <img src={foto.urlFirmada} alt={`Foto panorámica del ${formatDate(foto.fechaSubida)}`} />
              <div className="panoramicas-item-pie">
                <span className="panoramicas-item-fecha">
                  {formatDate(foto.fechaSubida)} · {formatTime(foto.fechaSubida)}
                </span>
                <button
                  type="button"
                  className="panoramicas-item-eliminar"
                  onClick={() => eliminar(foto)}
                  disabled={eliminandoId === foto.id}
                  aria-label="Eliminar foto panorámica"
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FotosPanoramicasTab;
