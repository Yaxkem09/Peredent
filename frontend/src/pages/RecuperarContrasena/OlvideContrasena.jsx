import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { ROUTES } from '../../routes/routes';
import logo from '../../assets/logo.png';
import FondoDental from '../Login/FondoDental';
import '../Login/Login.css';
import './RecuperarContrasena.css';

// SCRUM-231: pantalla a la que lleva el enlace "¿Olvidaste tu contraseña?" del
// login. Pide correo o usuario y muestra SIEMPRE el mismo mensaje (SCRUM-233),
// así que no revela si la cuenta existe.
const MENSAJE_RESPALDO =
  'Si el correo o usuario está registrado, recibirás las instrucciones para restablecer tu contraseña.';

const OlvideContrasena = () => {
  const [identificador, setIdentificador] = useState('');
  const [error, setError] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const enviar = async (evento) => {
    evento.preventDefault();

    const vacio = identificador.trim() === '';
    setError(vacio);
    if (vacio) {
      return;
    }

    setEnviando(true);
    try {
      const data = await authService.solicitarRestablecimiento(identificador.trim());
      setMensaje(data?.message || MENSAJE_RESPALDO);
    } catch {
      // El backend responde 200 siempre; si falla la red se avisa igual, sin decir
      // nada sobre la cuenta.
      setMensaje('No pudimos procesar la solicitud. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setEnviando(false);
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
            <p className="login-welcome">Recuperar contraseña</p>
          </div>

          {mensaje ? (
            <div className="recuperar-exito" role="status">
              <p>{mensaje}</p>
              <Link className="login-olvide" to={ROUTES.LOGIN}>
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <p className="recuperar-texto">
                Escribí el correo o el usuario de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
              </p>

              <form className="login-form" onSubmit={enviar} noValidate>
                <div className="login-field">
                  <label htmlFor="identificador">Correo o usuario</label>
                  <input
                    id="identificador"
                    name="identificador"
                    type="text"
                    autoComplete="username"
                    value={identificador}
                    onChange={(evento) => {
                      setIdentificador(evento.target.value);
                      if (error) setError(false);
                    }}
                    className={error ? 'error' : ''}
                  />
                  <span className={`login-field-error${error ? ' show' : ''}`}>
                    Completa este campo para continuar.
                  </span>
                </div>

                <button type="submit" className="login-submit" disabled={enviando}>
                  {enviando ? 'Enviando...' : 'Enviar instrucciones'}
                </button>
              </form>

              <Link className="login-olvide" to={ROUTES.LOGIN}>
                Volver a iniciar sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OlvideContrasena;
