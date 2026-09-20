import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../routes/routes';
import logo from '../../assets/logo.png';
import './Login.css';

// Muelas decorativas del fondo: posición, tamaño, giro y ritmo de flotación.
const MUELAS = [
  { x: '6%', y: '12%', size: 54, dur: 9, delay: 0, giro: -14 },
  { x: '20%', y: '72%', size: 74, dur: 12, delay: -3, giro: 12 },
  { x: '34%', y: '6%', size: 40, dur: 10, delay: -6, giro: 18 },
  { x: '48%', y: '86%', size: 46, dur: 8, delay: -2, giro: -10 },
  { x: '64%', y: '4%', size: 66, dur: 13, delay: -5, giro: 10 },
  { x: '80%', y: '18%', size: 44, dur: 9, delay: -1, giro: -18 },
  { x: '90%', y: '58%', size: 78, dur: 11, delay: -7, giro: 14 },
  { x: '74%', y: '84%', size: 50, dur: 10, delay: -4, giro: -12 },
  { x: '3%', y: '46%', size: 42, dur: 12, delay: -8, giro: 16 },
  { x: '55%', y: '46%', size: 34, dur: 14, delay: -9, giro: -8 },
];

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
      <div className="login-teeth" aria-hidden="true">
        {MUELAS.map((m, i) => (
          <svg
            key={i}
            className="login-tooth"
            viewBox="0 0 64 72"
            style={{
              left: m.x,
              top: m.y,
              width: m.size,
              animationDuration: `${m.dur}s`,
              animationDelay: `${m.delay}s`,
              '--giro': `${m.giro}deg`,
            }}
          >
            <path
              d="M32 8c-6-5-20-4-23 8-2 9 3 15 4 24 1 9 3 24 9 24 5 0 4-16 10-16s5 16 10 16c6 0 8-15 9-24 1-9 6-15 4-24C53 4 38 3 32 8z"
              fill="currentColor"
            />
          </svg>
        ))}
      </div>
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
            <p className="login-welcome">Inicia sesión para continuar</p>
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
        </div>
      </div>
    </div>
  );
};

export default Login;
