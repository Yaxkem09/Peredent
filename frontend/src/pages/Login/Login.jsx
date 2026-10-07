import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../routes/routes';
import logo from '../../assets/logo.png';
import FondoDental from './FondoDental';
import RecuperarForm from './RecuperarForm';
import '../RecuperarContrasena/RecuperarContrasena.css';
import './Login.css';

// Tarjeta del login con dos formularios y el logo de la clínica encima de uno de
// ellos. En modo "login" el logo cubre la mitad izquierda y el formulario queda a
// la derecha; al tocar "¿Olvidaste tu contraseña?" el logo se desliza a la derecha
// y descubre el formulario de recuperación a la izquierda. La ruta
// /olvide-contrasena abre la misma pantalla ya en modo "recuperar".
const Login = ({ modoInicial = 'login' }) => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [errorUsuario, setErrorUsuario] = useState(false);
  const [errorClave, setErrorClave] = useState(false);
  const [errorBanner, setErrorBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [modo, setModo] = useState(modoInicial);
  const recuperando = modo === 'recuperar';

  const handleUsuarioChange = (e) => {
    setUsuario(e.target.value);
    if (errorUsuario) setErrorUsuario(false);
  };

  const handleClaveChange = (e) => {
    setClave(e.target.value);
    if (errorClave) setErrorClave(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const usuarioVacio = usuario.trim() === '';
    const claveVacia = clave.trim() === '';

    setErrorUsuario(usuarioVacio);
    setErrorClave(claveVacia);
    setErrorBanner(false);

    if (usuarioVacio || claveVacia) {
      return;
    }

    setLoading(true);
    try {
      await login({ usuario, clave });
      navigate(ROUTES.PACIENTES);
    } catch (error) {
      setErrorBanner(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <FondoDental />
      <div className={`login-card login-deslizante${recuperando ? ' modo-recuperar' : ''}`}>
        {/* Panel izquierdo: recuperación de contraseña (tapado por el logo en modo login). */}
        <section className="login-panel panel-recuperar" aria-hidden={!recuperando} inert={recuperando ? undefined : ''}>
          <div className="login-logo-movil">
            <img src={logo} alt="Peredent" />
          </div>
          <RecuperarForm onVolver={() => setModo('login')} />
        </section>

        {/* Panel derecho: inicio de sesión (tapado por el logo en modo recuperar). */}
        <section className="login-panel panel-login" aria-hidden={recuperando} inert={recuperando ? '' : undefined}>
          <div className="login-logo-movil">
            <img src={logo} alt="Peredent" />
          </div>
          <div className="login-encabezado">
            <h1 className="login-titulo">¡Hola de nuevo a Peredent!</h1>
            <p className="login-welcome">Ingresa tus datos para entrar al sistema.</p>
          </div>

          <div className={`login-error-banner${errorBanner ? ' show' : ''}`}>
            El usuario, correo o contraseña no son correctos.
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="usuario">Usuario o correo electrónico</label>
              <div className={`login-input-wrap${errorUsuario ? ' error' : ''}`}>
                <svg className="login-input-icono" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
                <input
                  id="usuario"
                  name="usuario"
                  type="text"
                  placeholder="Escribe tu usuario o correo"
                  autoComplete="username"
                  value={usuario}
                  onChange={handleUsuarioChange}
                  className={errorUsuario ? 'error' : ''}
                />
              </div>
              <span className={`login-field-error${errorUsuario ? ' show' : ''}`}>
                Escribe tu usuario o correo para continuar.
              </span>
            </div>

            <div className="login-field">
              <label htmlFor="clave">Contraseña</label>
              <div className={`login-input-wrap${errorClave ? ' error' : ''}`}>
                <svg className="login-input-icono" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <input
                  id="clave"
                  name="clave"
                  type={verClave ? 'text' : 'password'}
                  placeholder="Escribe tu contraseña"
                  autoComplete="current-password"
                  value={clave}
                  onChange={handleClaveChange}
                  className={errorClave ? 'error' : ''}
                />
                <button
                  type="button"
                  className="login-ver-clave"
                  onClick={() => setVerClave((valor) => !valor)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verClave ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.7 9.7 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.2 2.3-2.4 3.5M6.6 6.6C4.4 8 2.8 10.2 2 12c1 2.5 5 7 10 7 1.7 0 3.2-.5 4.5-1.2" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <span className={`login-field-error${errorClave ? ' show' : ''}`}>
                Escribe tu contraseña para continuar.
              </span>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>

            {/* SCRUM-231: desliza el logo y muestra el formulario de recuperación. */}
            <button type="button" className="login-olvide login-link-boton" onClick={() => setModo('recuperar')}>
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        </section>

        {/* Logo de la clínica: se desliza de un lado al otro según el modo. */}
        <div className="login-marca" aria-hidden="true">
          <img src={logo} alt="" className="login-marca-logo" />
        </div>
      </div>
    </div>
  );
};

export default Login;
