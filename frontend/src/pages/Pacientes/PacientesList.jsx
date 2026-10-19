import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pacientesService } from '../../services/pacientes.service';
import { formatDate } from '../../utils/formatters';
import { Alert, EmptyState, Loader } from '../../components/common';
import { ROUTES } from '../../routes/routes';
import '../../styles/page-header.css';
import BotonGuia from '../../components/common/BotonGuia';
import { GUIA_PACIENTES } from '../guiasPantallas';
import './Pacientes.css';

const inicialesDe = (nombres, apellidos) =>
  `${(nombres || '').charAt(0)}${(apellidos || '').charAt(0)}`.toUpperCase() || '—';

// Orden alfabético por nombre completo tal como se muestra (nombres + apellidos),
// sin distinguir mayúsculas ni tildes.
const collator = new Intl.Collator('es', { sensitivity: 'base' });
const ordenarAlfabeticamente = (lista) =>
  [...lista].sort((a, b) =>
    collator.compare(`${a.nombres ?? ''} ${a.apellidos ?? ''}`, `${b.nombres ?? ''} ${b.apellidos ?? ''}`),
  );

// Letra inicial sin tilde ("Óscar" va en la O) para separar el listado por letra.
const letraDe = (nombres) =>
  (nombres || '').trim().charAt(0).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() || '#';

// La lista ya viene ordenada, así que basta con cortar cada vez que cambia la letra.
const agruparPorLetra = (lista) =>
  lista.reduce((grupos, paciente) => {
    const letra = letraDe(paciente.nombres);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.letra === letra) ultimo.pacientes.push(paciente);
    else grupos.push({ letra, pacientes: [paciente] });
    return grupos;
  }, []);

const ABECEDARIO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');


  const PacientesList = () => {
    const navigate = useNavigate();
  const [pacientes, setPacientes] = useState([]);
  const [termino, setTermino] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const grupos = useMemo(() => agruparPorLetra(pacientes), [pacientes]);
  const letrasConPacientes = useMemo(() => new Set(grupos.map((grupo) => grupo.letra)), [grupos]);
  const [letraActiva, setLetraActiva] = useState(null);

  // Marca en el índice la letra de la sección que se está viendo al hacer scroll.
  useEffect(() => {
    if (grupos.length < 2 || typeof IntersectionObserver === 'undefined') return undefined;
    setLetraActiva(grupos[0].letra);
    const observer = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((entrada) => entrada.isIntersecting);
        if (visible) setLetraActiva(visible.target.dataset.letra);
      },
      { rootMargin: '-120px 0px -65% 0px' },
    );
    grupos.forEach((grupo) => {
      const seccion = document.getElementById(`pacientes-letra-${grupo.letra}`);
      if (seccion) observer.observe(seccion);
    });
    return () => observer.disconnect();
  }, [grupos]);

  const irALetra = (letra) => {
    setLetraActiva(letra);
    document.getElementById(`pacientes-letra-${letra}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

useEffect(() => {
  let activo = true;
  setCargando(true);
  setError(null);

  const timer = setTimeout(() => {
    const promesa = termino.trim()
      ? pacientesService.search(termino.trim())
      : pacientesService.getAll();

    promesa
      .then((data) => { if (activo) setPacientes(ordenarAlfabeticamente(data)); })
      .catch(() => { if (activo) setError('No se pudo cargar la lista de pacientes.'); })
      .finally(() => { if (activo) setCargando(false); });
  }, 400);

  return () => {
    activo = false;
    clearTimeout(timer);
  };
}, [termino]);
return (
    <div className="page-block pacientes-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Base de pacientes</div>
          <h2>Pacientes</h2>
          <p>Busca, registra y da seguimiento a cada expediente.</p>
        </div>
        <div className="page-head-acciones">
        <BotonGuia pasos={GUIA_PACIENTES} className="btn btn-md btn-head-sec" />
        <Link className="btn btn-primary pacientes-nuevo" to={ROUTES.PACIENTE_NUEVO}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo paciente
        </Link>
        </div>
      </div>

      <div className="pacientes-buscador">
        <span className="pacientes-buscador-icono" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
        </span>
        <input
          className="pacientes-buscador-input"
          type="text"
          placeholder="Buscar paciente por nombre, apellido o teléfono"
          aria-label="Buscar paciente"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
        />
        {termino && (
          <button
            type="button"
            className="pacientes-buscador-limpiar"
            onClick={() => setTermino('')}
            aria-label="Limpiar búsqueda"
          >
            ×
          </button>
        )}
      </div>

      {cargando ? (
        <Loader />
      ) : error ? (
        <Alert type="error">{error}</Alert>
      ) : pacientes.length === 0 ? (
        <EmptyState
          title="Sin pacientes registrados"
          description="Los pacientes que registres van a aparecer en este listado."
        />
      ) : (
        <>
          {grupos.length > 1 && (
            <nav className="pacientes-indice" aria-label="Ir a la letra">
              <span className="pacientes-indice-titulo">Ir a</span>
              <div className="pacientes-indice-letras">
                {ABECEDARIO.map((letra) => (
                  <button
                    type="button"
                    key={letra}
                    className={`pacientes-indice-letra${letraActiva === letra ? ' activa' : ''}`}
                    aria-current={letraActiva === letra ? 'true' : undefined}
                    disabled={!letrasConPacientes.has(letra)}
                    onClick={() => irALetra(letra)}
                  >
                    {letra}
                  </button>
                ))}
              </div>
            </nav>
          )}

          <div className="patient-list">
            {grupos.map((grupo) => (
              <section
                className="patient-group"
                key={grupo.letra}
                id={`pacientes-letra-${grupo.letra}`}
                data-letra={grupo.letra}
                aria-labelledby={`pacientes-letra-${grupo.letra}-titulo`}
              >
                <div className="patient-group-head">
                  <h3 className="patient-group-letra" id={`pacientes-letra-${grupo.letra}-titulo`}>
                    {grupo.letra}
                  </h3>
                  <span className="patient-group-linea" aria-hidden="true" />
                  <span className="patient-group-cuenta">
                    {grupo.pacientes.length} {grupo.pacientes.length === 1 ? 'paciente' : 'pacientes'}
                  </span>
                </div>
                <div className="patient-group-tarjetas">
                  {grupo.pacientes.map((paciente) => (
                    <div
                      className="patient-row"
                      key={paciente.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(ROUTES.PACIENTE_DETALLE(paciente.id))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') navigate(ROUTES.PACIENTE_DETALLE(paciente.id));
                      }}
                    >
                      <div className="patient-info">
                        <div className="patient-avatar">{inicialesDe(paciente.nombres, paciente.apellidos)}</div>
                        <div>
                          <div className="patient-name">
                            {paciente.nombres} {paciente.apellidos}
                          </div>
                          <div className="patient-meta">
                            <span className="patient-meta-item meta-telefono">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4.5 3.5h3.5l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3.5a1.5 1.5 0 0 1-1.6 1.5C10.5 19 5 13.5 3 6.1A1.5 1.5 0 0 1 4.5 3.5Z" />
                              </svg>
                              {paciente.telefono || 'Sin teléfono'}
                              {paciente.telefonoSecundario && ` · ${paciente.telefonoSecundario}`}
                            </span>
                            <span className="patient-meta-item meta-registro">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <rect x="3.5" y="5" width="17" height="15" rx="2" />
                                <path d="M3.5 9.5h17" />
                                <path d="M8 3v4M16 3v4" />
                              </svg>
                              Registrado el {formatDate(paciente.fechaRegistro)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="patient-quick-actions">
                        <Link
                          to={`${ROUTES.PACIENTE_DETALLE(paciente.id)}?tab=datos`}
                          className="btn btn-ficha btn-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Ficha
                        </Link>
                        <Link
                          to={`${ROUTES.PACIENTE_DETALLE(paciente.id)}?tab=plan`}
                          className="btn btn-plan btn-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Plan
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PacientesList;