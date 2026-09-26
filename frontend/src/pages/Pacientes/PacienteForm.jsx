import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pacientesService } from '../../services/pacientes.service';
import { historiaMedicaService } from '../../services/historia-medica.service';
import { calcularEdadTexto, esMenorDeEdad } from '../../utils/edad';
import { useNotification } from '../../hooks/useNotification';
import { Alert, Button, EmptyState, Loader } from '../../components/common';
import { ROUTES } from '../../routes/routes';
import '../../styles/page-header.css';
import './PacienteForm.css';

const CAMPOS_INICIALES = {
  nombres: '',
  apellidos: '',
  fechaNacimiento: '',
  sexo: 'Femenino',
  telefono: '',
  correo: '',
  nit: '',
  direccion: '',
  encargadoNombre: '',
  encargadoTelefono: '',
};

// El NIT es opcional: si se deja vacío se guarda como consumidor final ("CF").
const NIT_CONSUMIDOR_FINAL = 'CF';

const normalizarNit = (nit) => {
  const limpio = (nit || '').trim();
  return limpio === '' ? NIT_CONSUMIDOR_FINAL : limpio;
};

const mensajeError = (err) => {
  if (err?.response?.status === 404) {
    return 'El registro de pacientes todavía no está disponible en el servidor.';
  }
  return err?.response?.data?.message || 'No se pudo guardar el paciente. Intenta de nuevo.';
};

const mensajeErrorHistoria = (err, idPaciente) => {
  const detalle = err?.response?.data?.message || 'No se pudo guardar la historia médica.';
  return `El paciente se guardó correctamente (id ${idPaciente}), pero ${detalle} Revisá las condiciones marcadas y volvé a intentar — no hace falta volver a completar los datos personales.`;
};

const construirPayloadHistoria = (seleccionadas, observacionesGenerales) => ({
  observacionesGenerales: observacionesGenerales.trim() === '' ? null : observacionesGenerales,
  condiciones: Object.entries(seleccionadas)
    .filter(([, seleccion]) => seleccion.marcada)
    .map(([idCondicion, seleccion]) => ({
      idCondicion: Number(idCondicion),
      observacion: seleccion.observacion?.trim() === '' ? null : seleccion.observacion,
    })),
});

const IconoAlerta = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
);

const ICONOS = {
  persona: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
    </>
  ),
  contacto: (
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  ),
  encargado: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M17 14c2.2 0 3.8 1.2 4.5 3.5" />
    </>
  ),
  historia: (
    <>
      <path d="M9 4h6v3H9z" />
      <path d="M9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15" />
      <path d="M12 11v6M9 14h6" />
    </>
  ),
};

const Seccion = ({ icono, titulo, extra, variante, children }) => (
  <section className={`pf-section${variante ? ` pf-section-${variante}` : ''}`}>
    <header className="pf-section-head">
      <div className="pf-section-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ICONOS[icono]}
        </svg>
      </div>
      <h3 className="pf-section-title">{titulo}</h3>
      {extra && <div className="pf-section-extra">{extra}</div>}
    </header>
    {children}
  </section>
);

const Campo = ({ id, label, requerido, opcional, error, mensajeError, ayuda, full, children }) => (
  <div className={`pf-field${full ? ' pf-full' : ''}${error ? ' pf-invalid' : ''}`}>
    <label htmlFor={id} className="pf-label">
      {label}
      {requerido && (
        <span className="pf-req" aria-hidden="true">
          *
        </span>
      )}
      {opcional && <span className="pf-opt">Opcional</span>}
    </label>
    {children}
    {error ? (
      <div className="pf-warn" role="alert">
        <IconoAlerta />
        {mensajeError}
      </div>
    ) : (
      ayuda && <div className="pf-help">{ayuda}</div>
    )}
  </div>
);

const OPCIONES_SEXO = ['Femenino', 'Masculino', 'Otro'];

const PacienteForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const esEdicion = Boolean(id);

  const [datos, setDatos] = useState(CAMPOS_INICIALES);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // --- Historia médica: estado independiente del de datos personales de arriba ---
  const [condiciones, setCondiciones] = useState([]);
  const [cargandoCondiciones, setCargandoCondiciones] = useState(true);
  const [errorCondiciones, setErrorCondiciones] = useState(null);

  // { [idCondicion]: { marcada: boolean, observacion: string } }
  const [seleccionadas, setSeleccionadas] = useState({});
  const [observacionesGenerales, setObservacionesGenerales] = useState('');

  // Id del paciente ya creado, si el PUT de historia médica falló y estamos reintentando.
  const [pacienteCreadoId, setPacienteCreadoId] = useState(null);
  const [errorHistoria, setErrorHistoria] = useState(null);

  useEffect(() => {
    let activo = true;

    historiaMedicaService
      .getCondiciones()
      .then((data) => {
        if (activo) setCondiciones(data);
      })
      .catch(() => {
        if (activo) {
          setErrorCondiciones(
            'No se pudo cargar el catálogo de condiciones. Podés guardar los datos personales igual, pero la historia médica no va a estar disponible hasta que recargues la página.',
          );
        }
      })
      .finally(() => {
        if (activo) setCargandoCondiciones(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!esEdicion) return;
    let activo = true;

    pacientesService
      .getById(id)
      .then((data) => {
        if (!activo) return;
        setDatos({
          nombres: data.nombres || '',
          apellidos: data.apellidos || '',
          fechaNacimiento: data.fechaNacimiento?.slice(0, 10) || '',
          sexo: data.sexo || 'Femenino',
          telefono: data.telefono || '',
          correo: data.correo || '',
          // "CF" es el valor por defecto; se deja el campo vacío para no forzar al usuario a borrarlo.
          nit: data.nit && data.nit.toUpperCase() !== NIT_CONSUMIDOR_FINAL ? data.nit : '',
          direccion: data.direccion || '',
          encargadoNombre: data.encargadoNombre || '',
          encargadoTelefono: data.encargadoTelefono || '',
        });
      })
      .catch(() => {
        setError('No se pudo cargar los datos del paciente.');
      });
      return () => {
        activo = false;
      }
  }, [id, esEdicion]);

  const toggleCondicion = (idCondicion) => {
    setSeleccionadas((prev) => {
      const actual = prev[idCondicion];
      return {
        ...prev,
        [idCondicion]: { marcada: !actual?.marcada, observacion: actual?.observacion || '' },
      };
    });
  };

  const cambiarObservacionCondicion = (idCondicion, observacion) => {
    setSeleccionadas((prev) => ({
      ...prev,
      [idCondicion]: { marcada: true, observacion },
    }));
  };

  const esMenor = esMenorDeEdad(datos.fechaNacimiento);
  const edadTexto = calcularEdadTexto(datos.fechaNacimiento);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDatos((prev) => ({ ...prev, [name]: value }));
    if (errores[name] && value.trim() !== '') {
      setErrores((prev) => ({ ...prev, [name]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setErrorHistoria(null);

    // Si ya creamos el paciente en un intento anterior y solo falló la historia
    // médica, reintentamos directo con ese id — no volvemos a crear el paciente.
    let idPaciente = pacienteCreadoId;
    let payload = null;

    if (!idPaciente) {
      const camposRequeridos = ['nombres', 'apellidos', 'fechaNacimiento', 'telefono'];
      if (esMenor) camposRequeridos.push('encargadoNombre', 'encargadoTelefono');

      const nuevosErrores = {};
      let esValido = true;
      camposRequeridos.forEach((campo) => {
        const vacio = datos[campo].trim() === '';
        nuevosErrores[campo] = vacio;
        if (vacio) esValido = false;
      });
      setErrores(nuevosErrores);

      if (!esValido) {
        const primerInvalido = camposRequeridos.find((campo) => nuevosErrores[campo]);
        document.getElementById(primerInvalido)?.focus();
        setError(
          esMenor
            ? 'Completa nombre, apellidos, fecha de nacimiento, teléfono y los datos del encargado antes de guardar.'
            : 'No se puede guardar sin nombre, apellidos, fecha de nacimiento y al menos un teléfono.',
        );
        return;
      }

      payload = { ...datos, nit: normalizarNit(datos.nit) };
      if (!esMenor) {
        delete payload.encargadoNombre;
        delete payload.encargadoTelefono;
      }
    }

    setGuardando(true);

    if(esEdicion) {
      try {
        await pacientesService.update(id, payload);
        notify('Paciente actualizado exitosamente.');
        navigate(ROUTES.PACIENTE_DETALLE(id));
      } catch (err) {
        setError(mensajeError(err));
      } finally {
        setGuardando(false);
      }
      return;
    }

    if (!idPaciente) {
      try {
        const pacienteCreado = await pacientesService.create(payload);
        idPaciente = pacienteCreado.id;
        setPacienteCreadoId(idPaciente);
      } catch (err) {
        setError(mensajeError(err));
        setGuardando(false);
        return;
      }
    }

    try {
      await historiaMedicaService.guardar(idPaciente, construirPayloadHistoria(seleccionadas, observacionesGenerales));
      notify('Paciente guardado exitosamente.');
      navigate(ROUTES.PACIENTES);
    } catch (err) {
      setErrorHistoria(mensajeErrorHistoria(err, idPaciente));
    } finally {
      setGuardando(false);
    }
  };

  const marcadas = Object.values(seleccionadas).filter((seleccion) => seleccion.marcada).length;

  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Base de pacientes</div>
          <h2>{esEdicion ? 'Editar paciente' : 'Nuevo paciente'}</h2>
          <p>{esEdicion ? 'Actualiza los datos personales y de contacto del paciente.' : 'Registra los datos personales y de contacto del paciente.'}</p>
        </div>
      </div>

      <form className="pf-form" onSubmit={handleSubmit} noValidate>
        {error && <Alert type="error">{error}</Alert>}
        {errorHistoria && <Alert type="error">{errorHistoria}</Alert>}

        <Seccion icono="persona" titulo="Datos personales">
          <div className="pf-grid">
            <Campo id="nombres" label="Nombres" requerido error={errores.nombres} mensajeError="Ingresa los nombres del paciente.">
              <input
                id="nombres"
                name="nombres"
                type="text"
                autoComplete="off"
                placeholder="Ej. María José"
                value={datos.nombres}
                onChange={handleChange}
              />
            </Campo>
            <Campo id="apellidos" label="Apellidos" requerido error={errores.apellidos} mensajeError="Ingresa los apellidos del paciente.">
              <input
                id="apellidos"
                name="apellidos"
                type="text"
                autoComplete="off"
                placeholder="Ej. González López"
                value={datos.apellidos}
                onChange={handleChange}
              />
            </Campo>
            <Campo
              id="fechaNacimiento"
              label="Fecha de nacimiento"
              requerido
              error={errores.fechaNacimiento}
              mensajeError="Selecciona la fecha de nacimiento."
            >
              <input
                id="fechaNacimiento"
                name="fechaNacimiento"
                type="date"
                value={datos.fechaNacimiento}
                onChange={handleChange}
              />
            </Campo>
            <div className="pf-field">
              <span className="pf-label">Edad</span>
              <div className={`pf-readonly${edadTexto ? '' : ' pf-readonly-vacio'}`} aria-live="polite">
                {edadTexto || 'Se calcula con la fecha de nacimiento'}
                {esMenor && <span className="pf-chip pf-chip-amber">Menor de edad</span>}
              </div>
            </div>
            <div className="pf-field pf-full">
              <span className="pf-label" id="sexo-label">
                Sexo
              </span>
              <div className="pf-segmented" role="radiogroup" aria-labelledby="sexo-label">
                {OPCIONES_SEXO.map((opcion) => (
                  <label key={opcion} className={`pf-segment${datos.sexo === opcion ? ' pf-segment-on' : ''}`}>
                    <input type="radio" name="sexo" value={opcion} checked={datos.sexo === opcion} onChange={handleChange} />
                    {opcion}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Seccion>

        <Seccion icono="contacto" titulo="Contacto">
          <div className="pf-grid">
            <Campo id="telefono" label="Teléfono" requerido error={errores.telefono} mensajeError="Ingresa al menos un teléfono.">
              <input
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="tel"
                placeholder="Ej. 5512 3344"
                value={datos.telefono}
                onChange={handleChange}
              />
            </Campo>
            <Campo id="correo" label="Correo electrónico" opcional>
              <input
                id="correo"
                name="correo"
                type="email"
                placeholder="nombre@correo.com"
                value={datos.correo}
                onChange={handleChange}
              />
            </Campo>
            <Campo id="nit" label="NIT" opcional ayuda="Si se deja vacío se guardará como CF (consumidor final).">
              <input
                id="nit"
                name="nit"
                type="text"
                maxLength={15}
                autoComplete="off"
                placeholder="Ej. 1234567-8"
                value={datos.nit}
                onChange={handleChange}
              />
            </Campo>
            <Campo id="direccion" label="Dirección" opcional>
              <input
                id="direccion"
                name="direccion"
                type="text"
                placeholder="Calle, zona, municipio"
                value={datos.direccion}
                onChange={handleChange}
              />
            </Campo>
          </div>
        </Seccion>

        {esMenor && (
          <Seccion
            icono="encargado"
            variante="aviso"
            titulo="Datos del encargado"
          >
            <div className="pf-grid">
              <Campo
                id="encargadoNombre"
                label="Nombre del encargado"
                requerido
                error={errores.encargadoNombre}
                mensajeError="Obligatorio para pacientes menores de edad."
              >
                <input
                  id="encargadoNombre"
                  name="encargadoNombre"
                  type="text"
                  placeholder="Ej. Carlos Pérez"
                  value={datos.encargadoNombre}
                  onChange={handleChange}
                />
              </Campo>
              <Campo
                id="encargadoTelefono"
                label="Teléfono del encargado"
                requerido
                error={errores.encargadoTelefono}
                mensajeError="Obligatorio para pacientes menores de edad."
              >
                <input
                  id="encargadoTelefono"
                  name="encargadoTelefono"
                  type="tel"
                  inputMode="tel"
                  placeholder="Ej. 5512 3344"
                  value={datos.encargadoTelefono}
                  onChange={handleChange}
                />
              </Campo>
            </div>
          </Seccion>
        )}

        {!esEdicion && (
          <Seccion
            icono="historia"
            titulo="Historia médica"
            extra={
              !cargandoCondiciones &&
              !errorCondiciones && (
                <span className={`pf-chip${marcadas > 0 ? ' pf-chip-accent' : ''}`}>
                  {marcadas === 0 ? 'Ninguna marcada' : marcadas === 1 ? '1 marcada' : `${marcadas} marcadas`}
                </span>
              )
            }
          >
            {cargandoCondiciones ? (
              <div className="hm-loading">
                <Loader label="Cargando catálogo de condiciones…" />
                <span>Cargando catálogo de condiciones…</span>
              </div>
            ) : errorCondiciones ? (
              <Alert type="error">{errorCondiciones}</Alert>
            ) : (
              <div className="pf-hm-grid">
                {condiciones.map((condicion) => {
                  const seleccion = seleccionadas[condicion.idCondicion];
                  const marcada = Boolean(seleccion?.marcada);
                  const checkboxId = `hm-${condicion.idCondicion}`;
                  const observacionId = `hm-obs-${condicion.idCondicion}`;
                  return (
                    <div className={`pf-hm-item${marcada ? ' pf-hm-item-on' : ''}`} key={condicion.idCondicion}>
                      <label className="pf-hm-check" htmlFor={checkboxId}>
                        <input
                          type="checkbox"
                          id={checkboxId}
                          checked={marcada}
                          onChange={() => toggleCondicion(condicion.idCondicion)}
                        />
                        <span className="pf-hm-num">{condicion.idCondicion}</span>
                        <span>{condicion.nombreCondicion}</span>
                      </label>
                      {marcada && (
                        <input
                          id={observacionId}
                          className="pf-hm-obs"
                          type="text"
                          autoFocus
                          aria-label={`Observación (${condicion.nombreCondicion})`}
                          placeholder="Detalle (opcional)"
                          value={seleccion?.observacion || ''}
                          onChange={(e) => cambiarObservacionCondicion(condicion.idCondicion, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pf-field pf-hm-observaciones">
              <label htmlFor="observacionesGenerales" className="pf-label">
                Observaciones generales
                <span className="pf-opt">Opcional</span>
              </label>
              <textarea
                id="observacionesGenerales"
                rows={3}
                placeholder="Alergias, medicamentos actuales u otras notas relevantes para el tratamiento"
                value={observacionesGenerales}
                onChange={(e) => setObservacionesGenerales(e.target.value)}
              />
            </div>
          </Seccion>
        )}

        <div className="pf-footer">
          <span className="pf-footer-nota">
            <span className="pf-req">*</span> Campos obligatorios
          </span>
          <div className="pf-footer-botones">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(esEdicion ? ROUTES.PACIENTE_DETALLE(id) : ROUTES.PACIENTES)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={guardando}>
              {pacienteCreadoId ? 'Reintentar guardar historia médica' : esEdicion ? 'Guardar cambios' : 'Guardar paciente'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PacienteForm;
