import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pacientesService } from '../../services/pacientes.service';
import { calcularEdadTexto, esMenorDeEdad } from '../../utils/edad';
import { useNotification } from '../../hooks/useNotification';
import { Alert, Button, EmptyState } from '../../components/common';
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

const PacienteForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const esEdicion = Boolean(id);

  const [datos, setDatos] = useState(CAMPOS_INICIALES);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

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

    const payload = { ...datos };
    if (!esMenor) {
      delete payload.encargadoNombre;
      delete payload.encargadoTelefono;
    }

    setGuardando(true);
    try {
      await pacientesService.create(payload);
      notify('Paciente guardado exitosamente.');
      navigate(ROUTES.PACIENTES);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  if (esEdicion) {
    return (
      <div className="page-block">
        <div className="page-head">
          <div>
            <div className="eyebrow">Base de pacientes</div>
            <h2>Editar paciente</h2>
            <p>Actualiza los datos personales y de contacto del paciente.</p>
          </div>
        </div>

        <EmptyState
          title="Edición en construcción"
          description="La edición de pacientes existentes (historia SCRUM-20 / SCRUM-22) se implementa en una próxima iteración."
          action={
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Volver
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Base de pacientes</div>
          <h2>Nuevo paciente</h2>
          <p>Registra los datos personales y de contacto del paciente.</p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

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

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.PACIENTES)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={guardando}>
            Guardar paciente
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PacienteForm;
