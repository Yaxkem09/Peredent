import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { ROUTES } from '../../routes/routes';
import { PoliticaContrasena } from '../../components/common';
import { validarPoliticaContrasena } from '../../utils/politicaContrasena';
import logo from '../../assets/logo.png';
import FondoDental from '../Login/FondoDental';
import '../Login/Login.css';
import './RecuperarContrasena.css';

// SCRUM-234/235/236: pantalla del enlace que llega por correo. Valida el token al
// cargar (si no sirve, no muestra el formulario), guarda la contraseña nueva
// respetando la política y avisa del éxito antes de volver al login.
const SEGUNDOS_PARA_VOLVER = 4;

const RestablecerContrasena = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [validando, setValidando] = useState(true);
  const [tokenValido, setTokenValido] = useState(false);
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    let activo = true;

    if (!token) {
      setValidando(false);
      setTokenValido(false);
      return () => {
        activo = false;
      };
    }

    authService
      .validarTokenRestablecimiento(token)
      .then((data) => {
        if (activo) setTokenValido(Boolean(data?.valido));
      })
      .catch(() => {
        if (activo) setTokenValido(false);
      })
      .finally(() => {
        if (activo) setValidando(false);
      });

    return () => {
      activo = false;
    };
  }, [token]);

  useEffect(() => {
    if (!exito) return undefined;

    const temporizador = setTimeout(() => navigate(ROUTES.LOGIN, { replace: true }), SEGUNDOS_PARA_VOLVER * 1000);
    return () => clearTimeout(temporizador);
  }, [exito, navigate]);

  const guardar = async (evento) => {
    evento.preventDefault();
    setError(null);

    // Se valida en el cliente para avisar rápido; el backend valida lo mismo.
    const errorPolitica = validarPoliticaContrasena(nueva);
    if (errorPolitica) {
      setError(errorPolitica);
      return;
    }

    if (nueva !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setGuardando(true);
    try {
      await authService.restablecerContrasena({ token, nuevaContrasena: nueva, confirmacion });
      setExito(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo cambiar la contraseña. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="login-screen">
      <FondoDental />
      <div className="login-card card-angosta">
        <div className="login-form-col">
          <div className="login-brand">
            <div className="login-logo">
              <img src={logo} alt="Peredent - Odontología General · Ortodoncia · Cirugía Maxilofacial" />
            </div>
            <h1 className="login-titulo">Nueva contraseña</h1>
          </div>

          {validando && <p className="recuperar-texto">Validando el enlace…</p>}

          {!validando && exito && (
            <div className="recuperar-exito" role="status">
              <p>Tu contraseña se cambió correctamente. Te llevamos al inicio de sesión…</p>
              <Link className="login-olvide" to={ROUTES.LOGIN}>
                Ir ahora
              </Link>
            </div>
          )}

          {!validando && !exito && !tokenValido && (
            <div className="recuperar-error" role="alert">
              <p>El enlace no es válido o ya expiró. Solicita uno nuevo.</p>
              <Link className="login-olvide" to={ROUTES.OLVIDE_CONTRASENA}>
                Pedir un enlace nuevo
              </Link>
            </div>
          )}

          {!validando && !exito && tokenValido && (
            <form className="login-form" onSubmit={guardar} noValidate>
              <div className="login-field">
                <label htmlFor="nueva">Nueva contraseña</label>
                <div className="campo-con-boton">
                  <input
                    id="nueva"
                    name="nueva"
                    type={mostrar ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={nueva}
                    onChange={(evento) => setNueva(evento.target.value)}
                  />
                  <button type="button" className="campo-ver" onClick={() => setMostrar((valor) => !valor)}>
                    {mostrar ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="confirmacion">Confirmá la contraseña</label>
                <input
                  id="confirmacion"
                  name="confirmacion"
                  type={mostrar ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmacion}
                  onChange={(evento) => setConfirmacion(evento.target.value)}
                />
              </div>

              <PoliticaContrasena clave={nueva} />

              {error && <div className="login-error-banner show">{error}</div>}

              <button type="submit" className="login-submit" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar contraseña'}
              </button>

              <Link className="login-olvide" to={ROUTES.LOGIN}>
                Volver a iniciar sesión
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestablecerContrasena;
