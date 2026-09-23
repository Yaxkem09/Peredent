import { useState } from 'react';
import { recetarioService } from '../../services/recetario.service';
import { useNotification } from '../../hooks/useNotification';
import { formatDate, formatTime } from '../../utils/formatters';
import { IconBack, IconPrinter, IconDownload, IconTrash } from './RecetarioIcons';
import logo from '../../assets/logo.png';
import './Recetario.css';

// El backend manda el nombre en Content-Disposition; si por CORS no llega, se
// usa este como respaldo.
const NOMBRE_PDF_POR_DEFECTO = 'receta.pdf';

const nombreArchivoDesde = (contentDisposition) => {
  if (!contentDisposition) return NOMBRE_PDF_POR_DEFECTO;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition);
  return match ? decodeURIComponent(match[1]) : NOMBRE_PDF_POR_DEFECTO;
};

// Vista/impresión de una receta ya guardada. Solo necesita el DTO que
// devuelve el backend (ya trae idPaciente e idReceta), así que se usa igual
// desde la pestaña "Recetario" del expediente y desde el menú principal.
const RecetaDocumento = ({ receta: r, onVolver, onEliminada }) => {
  const { notify } = useNotification();
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const descargarPdf = async () => {
    setGenerandoPdf(true);
    try {
      const respuesta = await recetarioService.descargarPdf(r.idPaciente, r.idReceta);
      const url = URL.createObjectURL(respuesta.data);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombreArchivoDesde(respuesta.headers['content-disposition']);
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify('No se pudo descargar el PDF de la receta. Intenta de nuevo.');
    } finally {
      setGenerandoPdf(false);
    }
  };

  const eliminar = async () => {
    if (!window.confirm('¿Eliminar esta receta? Esta acción no se puede deshacer.')) return;
    setEliminando(true);
    try {
      await recetarioService.eliminar(r.idPaciente, r.idReceta);
      onEliminada(r.idReceta);
    } catch {
      notify('No se pudo eliminar la receta. Intenta de nuevo.');
      setEliminando(false);
    }
  };

  return (
    <div className="receta-print-wrap">
      <div className="receta-doc-acciones">
        <div className="receta-doc-acciones-grupo">
          <button type="button" className="btn btn-secondary btn-md" onClick={onVolver}>
            <IconBack /> Volver al recetario
          </button>
          <button type="button" className="btn btn-danger btn-md" onClick={eliminar} disabled={eliminando}>
            <IconTrash /> {eliminando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
        <div className="receta-doc-acciones-grupo">
          <button
            type="button"
            className="btn btn-outline-teal btn-md"
            onClick={descargarPdf}
            disabled={generandoPdf}
          >
            <IconDownload /> {generandoPdf ? 'Generando…' : 'Descargar PDF'}
          </button>
          <button type="button" className="btn btn-primary btn-md" onClick={() => window.print()}>
            <IconPrinter /> Imprimir
          </button>
        </div>
      </div>

      <div className="receta-doc receta-print">
        <div className="receta-head">
          <div className="receta-logo">
            <img src={logo} alt="Peredent" />
          </div>
          <div className="receta-clinica-datos">
            <div className="receta-odontologo-nombre">
              Dr(a). {r.odontologo.nombres} {r.odontologo.apellidos}
            </div>
            <div>Colegiado No. {r.odontologo.colegiado}</div>
            <div>{r.odontologo.direccion}</div>
            <div>
              Tel. {r.odontologo.telefono} · {r.odontologo.correo}
            </div>
          </div>
          <div className="receta-fecha">
            <span className="receta-fecha-label">Fecha de emisión</span>
            <span className="receta-fecha-valor">{formatDate(r.fechaEmision)}</span>
            <span className="receta-fecha-hora">{formatTime(r.fechaEmision)}</span>
          </div>
        </div>

        <div className="receta-paciente">
          <span className="receta-paciente-label">Paciente:</span> {r.nombrePaciente}
        </div>

        <div className="receta-medicamentos">
          {r.medicamentos.map((m, i) => (
            <div className="receta-medicamento" key={i}>
              <div className="receta-medicamento-nombre">
                {m.nombre}
                {m.presentacion ? ` ${m.presentacion}` : ''}
              </div>
              {m.indicaciones && <div className="receta-medicamento-indicaciones">{m.indicaciones}</div>}
            </div>
          ))}
        </div>

        {r.notasAdicionales && (
          <div className="receta-otras">
            <div className="receta-otras-label">Otras indicaciones</div>
            <p>{r.notasAdicionales}</p>
          </div>
        )}

        <div className="receta-firma">
          <div className="receta-firma-linea" />
          <div className="receta-firma-texto">
            Firma y Sello — Dr(a). {r.odontologo.nombres} {r.odontologo.apellidos}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecetaDocumento;
