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
  direccion: '',
  encargadoNombre: '',
  encargadoTelefono: '',
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
        setError(
          esMenor
            ? 'Completa nombre, apellidos, fecha de nacimiento, teléfono y los datos del encargado antes de guardar.'
            : 'No se puede guardar sin nombre, apellidos, fecha de nacimiento y al menos un teléfono.',
        );
        return;
      }

      payload = { ...datos };
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

  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Base de pacientes</div>
          <h2>{esEdicion ? 'Editar paciente' : 'Nuevo paciente'}</h2>
          <p>{esEdicion ? 'Actualiza los datos personales y de contacto del paciente.' : 'Registra los datos personales y de contacto del paciente.'}</p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {errorHistoria && <Alert type="error">{errorHistoria}</Alert>}

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        <div className="section-label">Datos personales</div>
        <div className="field-grid">
          <div className={`field${errores.nombres ? ' error' : ''}`}>
            <label htmlFor="nombres">Nombres</label>
            <input
              id="nombres"
              name="nombres"
              type="text"
              placeholder="Ej. María"
              value={datos.nombres}
              onChange={handleChange}
            />
            <div className="warn">Este campo es obligatorio.</div>
          </div>
          <div className={`field${errores.apellidos ? ' error' : ''}`}>
            <label htmlFor="apellidos">Apellidos</label>
            <input
              id="apellidos"
              name="apellidos"
              type="text"
              placeholder="Ej. González"
              value={datos.apellidos}
              onChange={handleChange}
            />
            <div className="warn">Este campo es obligatorio.</div>
          </div>
          <div className={`field${errores.fechaNacimiento ? ' error' : ''}`}>
            <label htmlFor="fechaNacimiento">Fecha de nacimiento</label>
            <input
              id="fechaNacimiento"
              name="fechaNacimiento"
              type="date"
              value={datos.fechaNacimiento}
              onChange={handleChange}
            />
            <div className="warn">Este campo es obligatorio.</div>
          </div>
          <div className="field">
            <label htmlFor="edadCalculada">Edad calculada</label>
            <input id="edadCalculada" type="text" placeholder="Se calcula sola" value={edadTexto} disabled />
          </div>
          <div className="field">
            <label htmlFor="sexo">Sexo</label>
            <select id="sexo" name="sexo" value={datos.sexo} onChange={handleChange}>
              <option>Femenino</option>
              <option>Masculino</option>
              <option>Otro</option>
            </select>
          </div>
          <div className={`field${errores.telefono ? ' error' : ''}`}>
            <label htmlFor="telefono">Teléfono</label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              placeholder="Ej. 5512 3344"
              value={datos.telefono}
              onChange={handleChange}
            />
            <div className="warn">Ingresa al menos un teléfono.</div>
          </div>
          <div className="field">
            <label htmlFor="correo">Correo electrónico</label>
            <input
              id="correo"
              name="correo"
              type="email"
              placeholder="nombre@correo.com"
              value={datos.correo}
              onChange={handleChange}
            />
          </div>
          <div className="field full">
            <label htmlFor="direccion">Dirección</label>
            <input
              id="direccion"
              name="direccion"
              type="text"
              placeholder="Dirección completa"
              value={datos.direccion}
              onChange={handleChange}
            />
          </div>
        </div>

        {esMenor && (
          <>
            <div className="section-label">Datos del encargado (paciente menor de edad)</div>
            <div className="field-grid">
              <div className={`field${errores.encargadoNombre ? ' error' : ''}`}>
                <label htmlFor="encargadoNombre">Nombre del encargado</label>
                <input
                  id="encargadoNombre"
                  name="encargadoNombre"
                  type="text"
                  placeholder="Ej. Carlos Pérez"
                  value={datos.encargadoNombre}
                  onChange={handleChange}
                />
                <div className="warn">Este campo es obligatorio para pacientes menores de edad.</div>
              </div>
              <div className={`field${errores.encargadoTelefono ? ' error' : ''}`}>
                <label htmlFor="encargadoTelefono">Teléfono del encargado</label>
                <input
                  id="encargadoTelefono"
                  name="encargadoTelefono"
                  type="tel"
                  placeholder="Ej. 5512 3344"
                  value={datos.encargadoTelefono}
                  onChange={handleChange}
                />
                <div className="warn">Este campo es obligatorio para pacientes menores de edad.</div>
              </div>
            </div>
          </>
        )}

        {!esEdicion && (
          <>
            <div className="section-label">Historia médica</div>
            {cargandoCondiciones ? (
              <div className="hm-loading">
                <Loader label="Cargando catálogo de condiciones…" />
                <span>Cargando catálogo de condiciones…</span>
              </div>
            ) : errorCondiciones ? (
              <Alert type="error">{errorCondiciones}</Alert>
            ) : (
              <div className="hm-grid">
                {condiciones.map((condicion) => {
                  const seleccion = seleccionadas[condicion.idCondicion];
                  const marcada = Boolean(seleccion?.marcada);
                  const checkboxId = `hm-${condicion.idCondicion}`;
                  const observacionId = `hm-obs-${condicion.idCondicion}`;
                  return (
                    <div className="hm-item" key={condicion.idCondicion}>
                      <div className="hm-check">
                        <input
                          type="checkbox"
                          id={checkboxId}
                          checked={marcada}
                          onChange={() => toggleCondicion(condicion.idCondicion)}
                        />
                        <label htmlFor={checkboxId}>
                          {condicion.idCondicion}. {condicion.nombreCondicion}
                        </label>
                      </div>
                      {marcada && (
                        <div className="hm-obs">
                          <label htmlFor={observacionId} className="hm-obs-label">
                            Observación ({condicion.nombreCondicion})
                          </label>
                          <input
                            id={observacionId}
                            type="text"
                            autoFocus
                            placeholder="Detalle (opcional)"
                            value={seleccion?.observacion || ''}
                            onChange={(e) => cambiarObservacionCondicion(condicion.idCondicion, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="field full hm-observaciones">
              <label htmlFor="observacionesGenerales">Observaciones generales</label>
              <textarea
                id="observacionesGenerales"
                placeholder="Notas adicionales relevantes para el tratamiento"
                value={observacionesGenerales}
                onChange={(e) => setObservacionesGenerales(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.PACIENTES)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={guardando}>
            {pacienteCreadoId ? 'Reintentar guardar historia médica' : 'Guardar paciente'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PacienteForm;
