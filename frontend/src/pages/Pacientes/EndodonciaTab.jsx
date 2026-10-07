import { useEffect, useState } from 'react';
import { endodonciaService } from '../../services/endodoncia.service';
import { protesisService } from '../../services/protesis.service';
import { Alert, Loader } from '../../components/common';
import './EndodonciaTab.css';

const PIEZAS = Array.from({ length: 32 }, (_, i) => String(i + 1));

const INDICACIONES_PROTESIS = [
  { clave: 'PPF', etiqueta: 'PPF', descripcion: 'Prótesis parcial fija' },
  { clave: 'PPRSup', etiqueta: 'PPR sup', descripcion: 'Parcial removible superior' },
  { clave: 'PPRInf', etiqueta: 'PPR inf', descripcion: 'Parcial removible inferior' },
  { clave: 'PTSup', etiqueta: 'PT sup', descripcion: 'Prótesis total superior' },
  { clave: 'PTInf', etiqueta: 'PT inf', descripcion: 'Prótesis total inferior' },
];

const piezaVacia = () => ({
  pieza: '', mm1: '', mm2: '', mm3: '', mm4: '',
  diametro: '', cuspide: '', obturacion: false,
});

const EndodonciaTab = ({ idPaciente }) => {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(null);
  const [exitoGuardar, setExitoGuardar] = useState(false);

  const [piezas, setPiezas] = useState([]);
  const [txPeriodontal, setTxPeriodontal] = useState(false);
  const [observacionesTxPeriodontal, setObservacionesTxPeriodontal] = useState('');
  const [observacionesEndodoncia, setObservacionesEndodoncia] = useState('');
  const [protesisIndicaciones, setProtesisIndicaciones] = useState({
  PPF: false, PPRSup: false, PPRInf: false, PTSup: false, PTInf: false,
  });
  const [observacionesProtesis, setObservacionesProtesis] = useState('');
  const [guardandoProtesis, setGuardandoProtesis] = useState(false);
  const [errorProtesis, setErrorProtesis] = useState(null);
  const [exitoProtesis, setExitoProtesis] = useState(false);

  useEffect(() => {
    endodonciaService.getByPaciente(idPaciente)
      .then((data) => {
        setPiezas((data.piezas || []).map((p) => ({
          pieza: p.pieza,
          mm1: p.mm1 ?? '', mm2: p.mm2 ?? '', mm3: p.mm3 ?? '', mm4: p.mm4 ?? '',
          diametro: p.diametro ?? '',
          cuspide: p.cuspide ?? '',
          obturacion: p.obturacion ?? false,
        })));
        setTxPeriodontal(data.txPeriodontal ?? false);
        setObservacionesTxPeriodontal(data.observacionesTxPeriodontal ?? '');
        setObservacionesEndodoncia(data.observacionesEndodoncia ?? '');
      })
      .catch(() => setError('No se pudo cargar el registro de endodoncia.'))
      .finally(() => setCargando(false));
  }, [idPaciente]);

  useEffect(() => {
    protesisService.getByPaciente(idPaciente)
      .then((data) => {
        setProtesisIndicaciones({
          PPF: data.ppf ?? false,
          PPRSup: data.pprSup ?? false,
          PPRInf: data.pprInf ?? false,
          PTSup: data.ptSup ?? false,
          PTInf: data.ptInf ?? false,
        });
        setObservacionesProtesis(data.observacionesProtesis ?? '');
      })
      .catch(() => {});
  }, [idPaciente]);

  const agregarPieza = () => setPiezas((prev) => [...prev, piezaVacia()]);
  const eliminarPieza = (i) => setPiezas((prev) => prev.filter((_, idx) => idx !== i));
  const actualizarPieza = (i, campo, valor) =>
    setPiezas((prev) => prev.map((p, idx) => idx === i ? { ...p, [campo]: valor } : p));

  const guardar = async () => {
    setGuardando(true);
    setErrorGuardar(null);
    setExitoGuardar(false);
    try {
      const payload = {
        txPeriodontal,
        observacionesTxPeriodontal: txPeriodontal ? observacionesTxPeriodontal : null,
        observacionesEndodoncia: observacionesEndodoncia || null,
        piezas: piezas.map((p) => ({
          pieza: p.pieza,
          mm1: p.mm1 !== '' ? parseInt(p.mm1) : null,
          mm2: p.mm2 !== '' ? parseInt(p.mm2) : null,
          mm3: p.mm3 !== '' ? parseInt(p.mm3) : null,
          mm4: p.mm4 !== '' ? parseInt(p.mm4) : null,
          diametro: p.diametro !== '' ? parseInt(p.diametro) : null,
          cuspide: p.cuspide || null,
          obturacion: p.obturacion,
        })),
      };
      const actualizado = await endodonciaService.guardar(idPaciente, payload);
      setPiezas((actualizado.piezas || []).map((p) => ({
        pieza: p.pieza,
        mm1: p.mm1 ?? '', mm2: p.mm2 ?? '', mm3: p.mm3 ?? '', mm4: p.mm4 ?? '',
        diametro: p.diametro ?? '',
        cuspide: p.cuspide ?? '',
        obturacion: p.obturacion ?? false,
      })));
      setTxPeriodontal(actualizado.txPeriodontal ?? false);
      setObservacionesTxPeriodontal(actualizado.observacionesTxPeriodontal ?? '');
      setObservacionesEndodoncia(actualizado.observacionesEndodoncia ?? '');
      setExitoGuardar(true);
    } catch {
      setErrorGuardar('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const guardarProtesis = async () => {
    setGuardandoProtesis(true);
    setErrorProtesis(null);
    setExitoProtesis(false);
    try {
      await protesisService.guardar(idPaciente, {
        ppf: protesisIndicaciones.PPF,
        pprSup: protesisIndicaciones.PPRSup,
        pprInf: protesisIndicaciones.PPRInf,
        ptSup: protesisIndicaciones.PTSup,
        ptInf: protesisIndicaciones.PTInf,
        observacionesProtesis: observacionesProtesis || null,
      });
      setExitoProtesis(true);
    } catch {
      setErrorProtesis('No se pudo guardar la prótesis. Intenta de nuevo.');
    } finally {
      setGuardandoProtesis(false);
    }
  };

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;

  // Endodoncia y Prótesis se muestran juntas: antes el bloque de prótesis
  // quedaba después del return y nunca se pintaba.
  return (
    <div className="endo">
      <section className="endo-card">
        <header className="endo-card-head">
          <span className="endo-card-icono">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4.6c-2-1.6-6.5-1.3-7.4 2.5-.6 2.9 1 4.8 1.3 7.7.3 2.9 1 7.2 2.9 7.2 1.6 0 1.3-5 3.2-5s1.6 5 3.2 5c1.9 0 2.6-4.3 2.9-7.2.3-2.9 1.9-4.8 1.3-7.7-.9-3.8-5.4-4.1-7.4-2.5z" />
            </svg>
          </span>
          <div className="endo-card-titulos">
            <h3 className="endo-card-titulo">Endodoncia</h3>
            <p className="endo-subtitle">Medidas técnicas por pieza.</p>
          </div>
          <span className="endo-contador">
            {piezas.length} pieza{piezas.length === 1 ? '' : 's'}
          </span>
        </header>

        {errorGuardar && <Alert type="error">{errorGuardar}</Alert>}
        {exitoGuardar && <Alert type="success">Registro guardado correctamente.</Alert>}

        <div className="endo-table-wrapper">
          <table className="endo-table">
            <thead>
              <tr>
                <th>Pieza</th>
                <th>MM 1</th>
                <th>MM 2</th>
                <th>MM 3</th>
                <th>MM 4</th>
                <th>Ø</th>
                <th>Cúspide ref.</th>
                <th>Obt.</th>
                <th aria-label="Quitar" />
              </tr>
            </thead>
            <tbody>
              {piezas.length === 0 && (
                <tr>
                  <td colSpan={9} className="endo-vacio">
                    Sin piezas registradas. Usa “Agregar pieza” para empezar.
                  </td>
                </tr>
              )}
              {piezas.map((p, i) => (
                <tr key={i}>
                  <td>
                    <select
                      value={p.pieza}
                      onChange={(e) => actualizarPieza(i, 'pieza', e.target.value)}
                      className="endo-select"
                    >
                      <option value="">—</option>
                      {PIEZAS.map((num) => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </td>
                  {['mm1', 'mm2', 'mm3', 'mm4'].map((campo) => (
                    <td key={campo}>
                      <input
                        type="number"
                        className="endo-input-num"
                        value={p[campo]}
                        onChange={(e) => actualizarPieza(i, campo, e.target.value)}
                        min="0"
                        step="1"
                      />
                    </td>
                  ))}
                  <td>
                    <input
                      type="number"
                      className="endo-input-num"
                      value={p.diametro}
                      onChange={(e) => actualizarPieza(i, 'diametro', e.target.value)}
                      min="0"
                      step="1"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="endo-input-text"
                      value={p.cuspide}
                      onChange={(e) => actualizarPieza(i, 'cuspide', e.target.value)}
                      placeholder="ej. Vestibular"
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      className="endo-check"
                      checked={p.obturacion}
                      onChange={(e) => actualizarPieza(i, 'obturacion', e.target.checked)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="endo-btn-remove"
                      onClick={() => eliminarPieza(i)}
                      aria-label="Quitar pieza"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" className="btn btn-outline-teal btn-sm endo-agregar" onClick={agregarPieza}>
          + Agregar pieza
        </button>

        <div className="endo-grid-2">
          <div className={`endo-panel endo-panel-tx${txPeriodontal ? ' activo' : ''}`}>
            <div className="endo-panel-head">
              <span className="endo-panel-icono" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3c-2.5 3-6 6-6 10a6 6 0 0 0 12 0c0-4-3.5-7-6-10z" />
                  <path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5" />
                </svg>
              </span>
              <span className="endo-panel-titulo">Tratamiento periodontal</span>
            </div>
            <label className="endo-switch">
              <input
                type="checkbox"
                checked={txPeriodontal}
                onChange={(e) => setTxPeriodontal(e.target.checked)}
              />
              <span className="endo-switch-pista" aria-hidden="true" />
              <span className="endo-switch-texto">Tx Periodontal</span>
            </label>
            {txPeriodontal ? (
              <textarea
                className="endo-textarea"
                rows={3}
                value={observacionesTxPeriodontal}
                onChange={(e) => setObservacionesTxPeriodontal(e.target.value)}
                placeholder="Especifica el tratamiento periodontal realizado"
              />
            ) : (
              <p className="endo-panel-ayuda">Actívalo si el paciente requiere tratamiento periodontal.</p>
            )}
          </div>

          <div className="endo-panel endo-panel-obs">
            <div className="endo-panel-head">
              <span className="endo-panel-icono" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 4.5h14a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1H10l-4.5 3.5V17H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z" />
                  <path d="M8 9h8M8 12.5h5" />
                </svg>
              </span>
              <label className="endo-panel-titulo" htmlFor="obs-endodoncia">Observaciones sobre endodoncia</label>
            </div>
            <textarea
              id="obs-endodoncia"
              className="endo-textarea"
              rows={3}
              value={observacionesEndodoncia}
              onChange={(e) => setObservacionesEndodoncia(e.target.value)}
              placeholder="Notas adicionales respecto a las medidas y tratamientos registrados en la tabla"
            />
          </div>
        </div>

        <div className="endo-acciones">
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar registro'}
          </button>
        </div>
      </section>

      <section className="endo-card">
        <header className="endo-card-head">
          <span className="endo-card-icono">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9.5c0-3 3.6-5.5 8-5.5s8 2.5 8 5.5" />
              <path d="M5 9.5h14v2.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
              <path d="M8 14v3M12 14v4M16 14v3" />
            </svg>
          </span>
          <div className="endo-card-titulos">
            <h3 className="endo-card-titulo">Prótesis</h3>
            <p className="endo-subtitle">Tipo de indicación protésica.</p>
          </div>
        </header>

        {errorProtesis && <Alert type="error">{errorProtesis}</Alert>}
        {exitoProtesis && <Alert type="success">Prótesis guardada correctamente.</Alert>}

        <p className="endo-obs-label">Indicaciones</p>
        <div className="protesis-checkboxes">
          {INDICACIONES_PROTESIS.map(({ clave, etiqueta, descripcion }) => (
            <label key={clave} className={`protesis-opcion${protesisIndicaciones[clave] ? ' activa' : ''}`}>
              <input
                type="checkbox"
                checked={protesisIndicaciones[clave]}
                onChange={(e) =>
                  setProtesisIndicaciones((prev) => ({ ...prev, [clave]: e.target.checked }))
                }
              />
              <span className="protesis-opcion-check" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <span className="protesis-opcion-etiqueta">{etiqueta}</span>
              <span className="protesis-opcion-desc">{descripcion}</span>
            </label>
          ))}
        </div>

        <div className="endo-panel endo-panel-obs endo-panel-full">
          <div className="endo-panel-head">
            <span className="endo-panel-icono" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4.5h14a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1H10l-4.5 3.5V17H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z" />
                <path d="M8 9h8M8 12.5h5" />
              </svg>
            </span>
            <label className="endo-panel-titulo" htmlFor="obs-protesis">Observaciones de prótesis</label>
          </div>
          <textarea
            id="obs-protesis"
            className="endo-textarea"
            rows={3}
            value={observacionesProtesis}
            onChange={(e) => setObservacionesProtesis(e.target.value)}
            placeholder="Notas adicionales sobre la indicación protésica"
          />
        </div>

        <div className="endo-acciones">
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={guardarProtesis}
            disabled={guardandoProtesis}
          >
            {guardandoProtesis ? 'Guardando…' : 'Guardar prótesis'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default EndodonciaTab;
