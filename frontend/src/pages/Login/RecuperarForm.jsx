import { useState } from 'react';
import { authService } from '../../services/auth.service';

// SCRUM-231: formulario de "¿Olvidaste tu contraseña?". Vive dentro de la tarjeta
// del login (panel que entra cuando el logo se desliza). Pide SOLO el correo de la
// cuenta y muestra SIEMPRE el mismo mensaje (SCRUM-233), así que no revela si la
// cuenta existe.
const MENSAJE_RESPALDO =
  'Si el correo está registrado, recibirás las instrucciones para restablecer tu contraseña.';

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RecuperarForm = ({ onVolver }) => {
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const enviar = async (evento) => {
    evento.preventDefault();

    const valor = correo.trim();
    if (!valor) {
      setError('Escribe tu correo electrónico para continuar.');
      return;
    }
    if (!FORMATO_CORREO.test(valor)) {
      setError('Escribe un correo electrónico válido.');
      return;
    }
    setError(null);

    setEnviando(true);
    try {
      const data = await authService.solicitarRestablecimiento(valor);
      setMensaje(data?.message || MENSAJE_RESPALDO);
    } catch {
      // El backend responde 200 siempre; si falla la red se avisa igual, sin decir
      // nada sobre la cuenta.
      setMensaje('No pudimos procesar la solicitud. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const volver = () => {
    setCorreo('');
    setError(null);
    setMensaje(null);
    onVolver();
  };

  return (
    <>
      <div className="login-encabezado">
        <span className="login-encabezado-icono" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 7.5-2" />
          </svg>
        </span>
        <h1 className="login-titulo">Recuperar contraseña</h1>
      </div>

      {mensaje ? (
        <div className="recuperar-exito" role="status">
          <p>{mensaje}</p>
        </div>
      ) : (
        <>
          <p className="recuperar-texto">
            Escribe el correo electrónico de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
          </p>

          <form className="login-form" onSubmit={enviar} noValidate>
            <div className="login-field">
              <label htmlFor="correo-recuperar">Correo electrónico</label>
              <div className={`login-input-wrap${error ? ' error' : ''}`}>
                <svg className="login-input-icono" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                <input
                  id="correo-recuperar"
                  name="correo"
                  type="email"
                  placeholder="Escribe tu correo"
                  autoComplete="email"
                  value={correo}
                  onChange={(evento) => {
                    setCorreo(evento.target.value);
                    if (error) setError(null);
                  }}
                  className={error ? 'error' : ''}
                />
              </div>
              <span className={`login-field-error${error ? ' show' : ''}`}>{error}</span>
            </div>

            <button type="submit" className="login-submit" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar instrucciones'}
            </button>
          </form>
        </>
      )}

      <button type="button" className="login-olvide login-link-boton" onClick={volver}>
        ← Volver a iniciar sesión
      </button>
    </>
  );
};

export default RecuperarForm;
