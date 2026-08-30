import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../routes/routes';
import logo from '../../assets/logo.png';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [errorUsuario, setErrorUsuario] = useState(false);
  const [errorClave, setErrorClave] = useState(false);
  const [errorBanner, setErrorBanner] = useState(false);
  const [loading, setLoading] = useState(false);

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
      <div className="login-card">
        <div className="login-photo">
          <svg
            className="login-photo-icon"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 8h2.5l1.3-2h8.4l1.3 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
            />
            <circle cx="12" cy="13.5" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="login-photo-text">Foto del consultorio</span>
        </div>

        <div className="login-form-col">
          <div className="login-brand">
            <div className="login-logo">
              <img src={logo} alt="Peredent - Odontología General · Ortodoncia · Cirugía Maxilofacial" />
            </div>
          </div>

          <div className={`login-error-banner${errorBanner ? ' show' : ''}`}>
            Usuario o contraseña incorrectos.
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="usuario">Ingrese el usuario</label>
              <input
                id="usuario"
                name="usuario"
                type="text"
                placeholder="usuario@peredent.com"
                autoComplete="username"
                value={usuario}
                onChange={handleUsuarioChange}
                className={errorUsuario ? 'error' : ''}
              />
              <span className={`login-field-error${errorUsuario ? ' show' : ''}`}>
                Completa este campo para continuar.
              </span>
            </div>

            <div className="login-field">
              <label htmlFor="clave">Ingrese la contraseña</label>
              <input
                id="clave"
                name="clave"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={clave}
                onChange={handleClaveChange}
                className={errorClave ? 'error' : ''}
              />
              <span className={`login-field-error${errorClave ? ' show' : ''}`}>
                Completa este campo para continuar.
              </span>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="login-note">
            Acceso de demostración: demo@peredent.com / 123456. Las contraseñas se guardan
            cifradas y la sesión se cierra sola tras un periodo de inactividad.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
