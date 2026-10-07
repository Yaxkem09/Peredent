import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { planTratamientoService } from '../../services/plan-tratamiento.service';
import { Alert, EmptyState, Loader } from '../../components/common';
import { useNotification } from '../../hooks/useNotification';
import { imprimirPdf } from '../../utils/imprimirPdf';
import './Presupuesto.css';

// SCRUM-77: vista del presupuesto que el paciente revisa y firma. El detalle de
// piezas, tratamientos y valores sale del plan de tratamiento reciente (SCRUM-79)
// y se vuelve a pedir cada vez que se abre la pestaña, así que refleja los
// últimos cambios guardados en el plan (SCRUM-205). Incluye la leyenda de
// conformidad (SCRUM-80) y los botones para exportar en PDF (SCRUM-78) o
// imprimir directamente ese mismo PDF.

// El backend manda el nombre en Content-Disposition; si por CORS no llega, se
// usa este como respaldo.
const NOMBRE_PDF_POR_DEFECTO = 'presupuesto.pdf';

const nombreArchivoDesde = (contentDisposition) => {
  if (!contentDisposition) return NOMBRE_PDF_POR_DEFECTO;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition);
  return match ? decodeURIComponent(match[1]) : NOMBRE_PDF_POR_DEFECTO;
};

const PresupuestoTab = ({ idPaciente }) => {
  const { notify } = useNotification();
  const [presupuesto, setPresupuesto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    planTratamientoService
      .getPresupuesto(idPaciente)
      .then((data) => {
        if (activo) setPresupuesto(data);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el presupuesto de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  const descargarPdf = async () => {
    setDescargando(true);
    try {
      const respuesta = await planTratamientoService.descargarPresupuestoPdf(idPaciente);
      const url = URL.createObjectURL(respuesta.data);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombreArchivoDesde(respuesta.headers['content-disposition']);
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify('No se pudo descargar el PDF del presupuesto. Intenta de nuevo.');
    } finally {
      setDescargando(false);
    }
  };

  const imprimir = async () => {
    setImprimiendo(true);
    try {
      const respuesta = await planTratamientoService.descargarPresupuestoPdf(idPaciente);
      imprimirPdf(respuesta.data);
    } catch {
      notify('No se pudo generar el presupuesto para imprimir. Intenta de nuevo.');
    } finally {
      setImprimiendo(false);
    }
  };

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!presupuesto) return null;

  if (!presupuesto.tienePlan) {
    return (
      <EmptyState
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 12h6M9 16h4M9 8h6" />
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
            <path d="M14 3v5h5" />
          </svg>
        }
        title="No hay un plan de tratamiento activo"
        description="El presupuesto se genera a partir del plan de tratamiento activo del paciente. En cuanto se registre uno nuevo desde la pestaña Plan de tratamiento, va a aparecer aquí."
      />
    );
  }

  return (
    <div className="presupuesto">
      <div className="presupuesto-acciones">
        <button
          type="button"
          className="btn btn-outline-teal btn-md"
          onClick={descargarPdf}
          disabled={descargando || imprimiendo}
        >
          {descargando ? 'Generando PDF…' : 'Descargar PDF'}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-md"
          onClick={imprimir}
          disabled={descargando || imprimiendo}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          {imprimiendo ? 'Preparando…' : 'Imprimir'}
        </button>
      </div>

      <div className="presupuesto-doc">
        <div className="presupuesto-head">
          <div>
            <div className="presupuesto-titulo">Presupuesto de tratamiento</div>
            <div className="presupuesto-paciente">{presupuesto.nombrePaciente}</div>
          </div>
          <div className="presupuesto-fechas">
            <div>
              <span className="presupuesto-fecha-label">Fecha de emisión</span>
              <span className="presupuesto-fecha-valor">{formatDate(presupuesto.fechaEmision)}</span>
            </div>
            <div>
              <span className="presupuesto-fecha-label">Plan del</span>
              <span className="presupuesto-fecha-valor">{formatDate(presupuesto.fechaPlan)}</span>
            </div>
          </div>
        </div>

        <table className="presupuesto-table">
          <thead>
            <tr>
              <th>Pieza</th>
              <th>Tratamiento</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {presupuesto.detalle.map((linea) => (
              <tr key={linea.pieza}>
                <td className="presupuesto-pieza">{linea.pieza}</td>
                <td>{linea.tratamiento}</td>
                <td className="presupuesto-valor">{formatCurrency(linea.valor)}</td>
              </tr>
            ))}
            <tr className="presupuesto-subtotal-row">
              <td colSpan={2}>Sub-total</td>
              <td>{formatCurrency(presupuesto.subtotal)}</td>
            </tr>
          </tbody>
        </table>

        <div className="presupuesto-resumen">
          <div className="presupuesto-resumen-linea">
            <span>Descuento</span>
            <span>- {formatCurrency(presupuesto.descuento)}</span>
          </div>
          <div className="presupuesto-resumen-linea presupuesto-resumen-total">
            <span>Total</span>
            <span>{formatCurrency(presupuesto.total)}</span>
          </div>
        </div>

        {presupuesto.leyendaConformidad && (
          <p className="presupuesto-leyenda">{presupuesto.leyendaConformidad}</p>
        )}
      </div>
    </div>
  );
};

export default PresupuestoTab;
