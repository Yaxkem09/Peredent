import { useEffect, useRef, useState } from 'react';
import { cuentaService } from '../../services/cuenta.service';
import { Alert, Button, Loader, Modal, PoliticaContrasena } from '../../components/common';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { validarPoliticaContrasena } from '../../utils/politicaContrasena';
import '../../styles/page-header.css';
import './Configuracion.css';

// SCRUM-237 a 239: "Configuración de usuario". Se llega desde el bloque de usuario
// del menú lateral. Se puede cambiar el nombre de usuario, el correo y la
// contraseña. Todo cambio se confirma con la contraseña actual, que se pide en un
// pop-up al presionar Guardar (no queda escrita en la pantalla).
const mensajeError = (err, fallback) => err?.response?.data?.message || fallback;

// Mismas reglas que valida el backend al cambiar el nombre de usuario.
const validarNombreUsuario = (nombre) => {
  const valor = nombre.trim();
  if (!valor) return 'El nombre de usuario es obligatorio.';
  if (valor.length > 50) return 'El nombre de usuario no puede tener más de 50 caracteres.';
  if (valor.includes('@')) return 'El nombre de usuario no puede tener el carácter @.';
  return null;
};

const IconOjo = ({ abierto }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {abierto ? (
      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.7 9.7 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.2 2.3-2.4 3.5M6.6 6.6C4.4 8 2.8 10.2 2 12c1 2.5 5 7 10 7 1.7 0 3.2-.5 4.5-1.2" />
    ) : (
      <>
        <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const IconCandado = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

// Campo de contraseña con botón para mostrarla u ocultarla.
const CampoClave = ({ id, label, value, onChange, autoComplete, inputRef }) => {
  const [ver, setVer] = useState(false);
  return (
    <div className="configuracion-campo">
      <label htmlFor={id}>{label}</label>
      <div className="configuracion-clave">
        <input
          ref={inputRef}
          id={id}
          name={id}
          type={ver ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(evento) => onChange(evento.target.value)}
        />
        <button
          type="button"
          className="configuracion-ver"
          onClick={() => setVer((valor) => !valor)}
          aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          title={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <IconOjo abierto={ver} />
        </button>
      </div>
    </div>
  );
};

const Configuracion = () => {
  const { notify } = useNotification();
  const { actualizarUsuario } = useAuth();

  const [cuenta, setCuenta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Datos de la cuenta (usuario y correo).
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [correo, setCorreo] = useState('');
  const [errorDatos, setErrorDatos] = useState(null);

  // Contraseña nueva.
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errorClave, setErrorClave] = useState(null);

  // Pop-up de confirmación: 'datos' o 'clave' según qué formulario lo abrió.
  const [confirmando, setConfirmando] = useState(null);
  const [claveActual, setClaveActual] = useState('');
  const [errorConfirmacion, setErrorConfirmacion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const claveActualRef = useRef(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);

    cuentaService
      .get()
      .then((data) => {
        if (!activo) return;
        setCuenta(data);
        setNombreUsuario(data?.nombreUsuario ?? '');
        setCorreo(data?.correo ?? '');
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar tu configuración. Intenta de nuevo.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  // Foco en la contraseña al abrir el pop-up.
  useEffect(() => {
    if (confirmando) setTimeout(() => claveActualRef.current?.focus(), 50);
  }, [confirmando]);

  const usuarioCambio = cuenta && nombreUsuario.trim() !== cuenta.nombreUsuario;
  const correoCambio = cuenta && correo.trim().toLowerCase() !== (cuenta.correo ?? '');
  const hayCambiosDatos = Boolean(usuarioCambio || correoCambio);

  const abrirConfirmacion = (tipo) => {
    setClaveActual('');
    setErrorConfirmacion(null);
    setConfirmando(tipo);
  };

  const cerrarConfirmacion = () => {
    if (guardando) return;
    setConfirmando(null);
    setClaveActual('');
    setErrorConfirmacion(null);
  };

  const pedirGuardarDatos = (evento) => {
    evento.preventDefault();
    setErrorDatos(null);

    if (usuarioCambio) {
      const errorNombre = validarNombreUsuario(nombreUsuario);
      if (errorNombre) {
        setErrorDatos(errorNombre);
        return;
      }
    }

    abrirConfirmacion('datos');
  };

  const pedirCambiarClave = (evento) => {
    evento.preventDefault();
    setErrorClave(null);

    // Se avisa antes de mandar; el backend valida exactamente lo mismo.
    const errorPolitica = validarPoliticaContrasena(nueva);
    if (errorPolitica) {
      setErrorClave(errorPolitica);
      return;
    }

    if (nueva !== confirmacion) {
      setErrorClave('Las contraseñas no coinciden.');
      return;
    }

    abrirConfirmacion('clave');
  };

  const guardarDatos = async () => {
    let actualizada = cuenta;

    if (usuarioCambio) {
      actualizada = await cuentaService.actualizarUsuario({
        nombreUsuario: nombreUsuario.trim(),
        contrasenaActual: claveActual,
      });
      // El token lleva el nombre de usuario: se reemplaza sin cerrar la sesión.
      actualizarUsuario({ token: actualizada.token, usuario: actualizada.nombreUsuario });
      setCuenta(actualizada);
      setNombreUsuario(actualizada.nombreUsuario);
    }

    if (correoCambio) {
      actualizada = await cuentaService.actualizarCorreo({ correo, contrasenaActual: claveActual });
      setCuenta(actualizada);
      setCorreo(actualizada?.correo ?? '');
    }

    notify('Tus datos se guardaron correctamente.');
  };

  const guardarClave = async () => {
    await cuentaService.cambiarContrasena({
      contrasenaActual: claveActual,
      nuevaContrasena: nueva,
      confirmacion,
    });
    setNueva('');
    setConfirmacion('');
    notify('Tu contraseña se cambió correctamente.');
  };

  const confirmar = async (evento) => {
    evento.preventDefault();
    if (!claveActual) {
      setErrorConfirmacion('Escribe tu contraseña actual.');
      return;
    }

    setGuardando(true);
    setErrorConfirmacion(null);
    try {
      if (confirmando === 'datos') await guardarDatos();
      else await guardarClave();
      setConfirmando(null);
      setClaveActual('');
    } catch (err) {
      // El error se muestra dentro del pop-up, sin cerrarlo.
      setErrorConfirmacion(mensajeError(err, 'No se pudieron guardar los cambios. Intenta de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Tu cuenta</div>
          <h2>Configuración de usuario</h2>
          <p>Revisa tus datos de acceso, actualiza tu usuario o correo y cambia tu contraseña.</p>
        </div>
      </div>

      <div className="configuracion">
        <section className="configuracion-perfil">
          <div className="configuracion-avatar" aria-hidden="true">
            {(cuenta?.nombreUsuario || '?').charAt(0).toUpperCase()}
          </div>
          <div className="configuracion-perfil-info">
            <span className="configuracion-perfil-nombre">{cuenta?.nombreUsuario}</span>
            <div className="configuracion-perfil-badges">
              <span className="configuracion-badge">{cuenta?.rol || 'Sin rol'}</span>
              {cuenta?.esAdmin && <span className="configuracion-badge admin">Administrador</span>}
            </div>
          </div>
          <div className="configuracion-perfil-correo">
            <span className="configuracion-dato-label">Correo registrado</span>
            <span className="configuracion-dato-valor">{cuenta?.correo || 'Sin correo registrado'}</span>
          </div>
        </section>

        <div className="configuracion-grid">
          <section className="configuracion-card">
            <div className="configuracion-card-head">
              <span className="configuracion-card-icono">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              </span>
              <div>
                <h3>Datos de la cuenta</h3>
                <p className="configuracion-nota">
                  Puedes iniciar sesión con tu usuario o con tu correo. El correo también sirve para recuperar la contraseña.
                </p>
              </div>
            </div>

            {errorDatos && <Alert type="error">{errorDatos}</Alert>}

            <form className="configuracion-form" onSubmit={pedirGuardarDatos} noValidate>
              <div className="configuracion-campo">
                <label htmlFor="nombre-usuario">Nombre de usuario</label>
                <input
                  id="nombre-usuario"
                  name="nombre-usuario"
                  type="text"
                  autoComplete="username"
                  maxLength={50}
                  value={nombreUsuario}
                  onChange={(evento) => setNombreUsuario(evento.target.value)}
                />
                <span className="configuracion-ayuda">Puede tener espacios, pero no el carácter @.</span>
              </div>

              <div className="configuracion-campo">
                <label htmlFor="correo">Correo electrónico</label>
                <input
                  id="correo"
                  name="correo"
                  type="email"
                  autoComplete="email"
                  value={correo}
                  onChange={(evento) => setCorreo(evento.target.value)}
                />
              </div>

              <p className="configuracion-nota">El rol y los permisos solo los puede cambiar un administrador.</p>

              <div className="configuracion-acciones">
                <button type="submit" className="btn btn-primary btn-md" disabled={!hayCambiosDatos}>
                  Guardar cambios
                </button>
              </div>
            </form>
          </section>

          <section className="configuracion-card">
            <div className="configuracion-card-head">
              <span className="configuracion-card-icono">
                <IconCandado />
              </span>
              <div>
                <h3>Cambiar contraseña</h3>
                <p className="configuracion-nota">Al guardar te pediremos tu contraseña actual para confirmar.</p>
              </div>
            </div>

            {errorClave && <Alert type="error">{errorClave}</Alert>}

            <form className="configuracion-form" onSubmit={pedirCambiarClave} noValidate>
              <CampoClave
                id="clave-nueva"
                label="Contraseña nueva"
                value={nueva}
                onChange={setNueva}
                autoComplete="new-password"
              />

              <CampoClave
                id="clave-confirmacion"
                label="Confirma la contraseña nueva"
                value={confirmacion}
                onChange={setConfirmacion}
                autoComplete="new-password"
              />

              {confirmacion !== '' && (
                <span className={`configuracion-coincide${nueva === confirmacion ? ' ok' : ''}`}>
                  {nueva === confirmacion ? '✓ Las contraseñas coinciden' : 'Las contraseñas todavía no coinciden'}
                </span>
              )}

              <PoliticaContrasena clave={nueva} />

              <div className="configuracion-acciones">
                <button type="submit" className="btn btn-primary btn-md" disabled={!nueva || !confirmacion}>
                  Cambiar contraseña
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>

      <Modal
        open={Boolean(confirmando)}
        onClose={cerrarConfirmacion}
        icon={<IconCandado size={20} />}
        title="Confirma que eres tú"
        footer={
          <>
            <Button variant="secondary" onClick={cerrarConfirmacion} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="form-confirmar-cuenta" loading={guardando}>
              Confirmar y guardar
            </Button>
          </>
        }
      >
        <form id="form-confirmar-cuenta" className="configuracion-confirmar" onSubmit={confirmar} noValidate>
          <p>
            {confirmando === 'clave'
              ? 'Para cambiar tu contraseña, escribe tu contraseña actual.'
              : 'Para guardar los cambios de tu cuenta, escribe tu contraseña actual.'}
          </p>

          {confirmando === 'datos' && (
            <ul className="configuracion-confirmar-cambios">
              {usuarioCambio && (
                <li>
                  Usuario: <strong>{cuenta?.nombreUsuario}</strong> → <strong>{nombreUsuario.trim()}</strong>
                </li>
              )}
              {correoCambio && (
                <li>
                  Correo: <strong>{correo.trim() || 'sin correo'}</strong>
                </li>
              )}
            </ul>
          )}

          <CampoClave
            id="clave-actual"
            label="Contraseña actual"
            value={claveActual}
            onChange={setClaveActual}
            autoComplete="current-password"
            inputRef={claveActualRef}
          />

          {errorConfirmacion && <Alert type="error">{errorConfirmacion}</Alert>}
        </form>
      </Modal>
    </div>
  );
};

export default Configuracion;
