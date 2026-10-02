import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '../../utils/formatters';
import { planTratamientoService } from '../../services/plan-tratamiento.service';
import { Alert, EmptyState, Loader } from '../../components/common';
import './HistorialTratamientos.css';

const soloFecha = (valor) => (valor ? String(valor).slice(0, 10) : '');

// Las piezas son etiquetas tipo "16", "5b", "21l": ordena por el número inicial
// y usa la etiqueta completa como desempate.
const ordenarPiezas = (a, b) => {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  if (Number.isNaN(na) || Number.isNaN(nb) || na === nb) return a.localeCompare(b);
  return na - nb;
};

const FILTROS_INICIALES = { pieza: '', desde: '', hasta: '' };

const HistorialTratamientosTab = ({ idPaciente }) => {
  const [tratamientos, setTratamientos] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    planTratamientoService
      .getHistorialTratamientos(idPaciente)
      .then((data) => {
        if (activo) setTratamientos(data);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el historial de tratamientos de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  const piezasDisponibles = useMemo(
    () => [...new Set(tratamientos.map((t) => t.pieza))].sort(ordenarPiezas),
    [tratamientos],
  );

  const filtrados = useMemo(
    () =>
      tratamientos.filter((t) => {
        const fecha = soloFecha(t.fecha);
        if (filtros.pieza && t.pieza !== filtros.pieza) return false;
        if (filtros.desde && fecha < filtros.desde) return false;
        if (filtros.hasta && fecha > filtros.hasta) return false;
        return true;
      }),
    [tratamientos, filtros],
  );

  const hayFiltrosActivos = Boolean(filtros.pieza || filtros.desde || filtros.hasta);

  const cambiarFiltro = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }));
  const limpiarFiltros = () => setFiltros(FILTROS_INICIALES);

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;

  if (tratamientos.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 12a8.5 8.5 0 1 0 2.9-6.4" />
            <path d="M3.5 4.5v4h4" />
            <path d="M12 8v4l3 2" />
          </svg>
        }
        title="Sin tratamientos en el historial"
        description="Cuando se marque un tratamiento como completado desde la pestaña Tratamiento pendiente, va a aparecer aquí."
      />
    );
  }

  return (
    <div className="htx">
      <div className="htx-filtros">
        <div className="htx-filtros-head">
          <span className="htx-filtros-icono" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16l-6.5 7.5V19l-3 1.5v-8z" />
            </svg>
          </span>
          <span className="htx-filtros-titulo">Filtrar tratamientos</span>
          <span className="htx-contador">
            {filtrados.length} de {tratamientos.length}
          </span>
          <button type="button" className="htx-limpiar" onClick={limpiarFiltros} disabled={!hayFiltrosActivos}>
            Limpiar filtros
          </button>
        </div>

        <div className="htx-filtros-cuerpo">
          <div className="htx-filtro">
            <label htmlFor="htx-pieza">Pieza dental</label>
            <select id="htx-pieza" value={filtros.pieza} onChange={(e) => cambiarFiltro('pieza', e.target.value)}>
              <option value="">Todas</option>
              {piezasDisponibles.map((pieza) => (
                <option key={pieza} value={pieza}>
                  {pieza}
                </option>
              ))}
            </select>
          </div>

          <div className="htx-filtro">
            <label htmlFor="htx-desde">Desde</label>
            <input
              id="htx-desde"
              type="date"
              value={filtros.desde}
              max={filtros.hasta || undefined}
              onChange={(e) => cambiarFiltro('desde', e.target.value)}
            />
          </div>

          <div className="htx-filtro">
            <label htmlFor="htx-hasta">Hasta</label>
            <input
              id="htx-hasta"
              type="date"
              value={filtros.hasta}
              min={filtros.desde || undefined}
              onChange={(e) => cambiarFiltro('hasta', e.target.value)}
            />
          </div>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          }
          title="Sin resultados"
          description="Ningún tratamiento del historial coincide con los filtros seleccionados."
        />
      ) : (
        <table className="htx-table">
          <thead>
            <tr>
              <th>Pieza</th>
              <th>Tratamiento</th>
              <th>Fecha</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((t, i) => (
              <tr key={`${t.pieza}-${soloFecha(t.fecha)}-${i}`}>
                <td>
                  <span className="htx-pieza-badge">{t.pieza}</span>
                </td>
                <td className="htx-tratamiento">{t.tratamiento}</td>
                <td>
                  <span className="htx-item-fecha">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3.5" y="5" width="17" height="15" rx="2" />
                      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                    </svg>
                    {formatDate(t.fecha)}
                  </span>
                </td>
                <td>
                  <span className="htx-item-estado">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                    Completado
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default HistorialTratamientosTab;
