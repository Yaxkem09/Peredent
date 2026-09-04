import { useEffect, useState } from 'react';
import { endodonciaService } from '../../services/endodoncia.service';
import { Alert, Loader } from '../../components/common';
import './EndodonciaTab.css';

const PIEZAS = Array.from({ length: 32 }, (_, i) => String(i + 1));

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

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="info-card">
      <strong>Endodoncia</strong>
      <p className="endo-subtitle">Medidas técnicas por pieza.</p>

      {errorGuardar && <Alert type="error">{errorGuardar}</Alert>}
      {exitoGuardar && <Alert type="success">Registro guardado correctamente.</Alert>}

      <div className="endo-table-wrapper">
        <table className="endo-table">
          <thead>
            <tr>
              <th>PIEZA</th>
              <th>MM</th><th>MM</th><th>MM</th><th>MM</th>
              <th>Ø</th>
              <th>CÚSPIDE REF.</th>
              <th>OBT</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
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
                    checked={p.obturacion}
                    onChange={(e) => actualizarPieza(i, 'obturacion', e.target.checked)}
                  />
                </td>
                <td>
                  <button type="button" className="endo-btn-remove" onClick={() => eliminarPieza(i)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn btn-outline-teal btn-sm" onClick={agregarPieza}>
        + Agregar pieza
      </button>

      <div className="endo-section">
        <label className="endo-checkbox-label">
          <input
            type="checkbox"
            checked={txPeriodontal}
            onChange={(e) => setTxPeriodontal(e.target.checked)}
          />
          Tx Periodontal
        </label>
        {txPeriodontal && (
          <textarea
            className="endo-textarea"
            rows={3}
            value={observacionesTxPeriodontal}
            onChange={(e) => setObservacionesTxPeriodontal(e.target.value)}
            placeholder="Especifica el tratamiento periodontal realizado"
          />
        )}
      </div>

      <div className="endo-section">
        <label className="endo-obs-label">Observaciones sobre endodoncia</label>
        <textarea
          className="endo-textarea"
          rows={4}
          value={observacionesEndodoncia}
          onChange={(e) => setObservacionesEndodoncia(e.target.value)}
          placeholder="Notas adicionales respecto a las medidas y tratamientos registrados en la tabla"
        />
      </div>

      <div className="detail-actions">
        <button
          type="button"
          className="btn btn-primary btn-md"
          onClick={guardar}
          disabled={guardando}
        >
          {guardando ? 'Guardando…' : 'Guardar registro'}
        </button>
      </div>
    </div>
  );
};

export default EndodonciaTab;