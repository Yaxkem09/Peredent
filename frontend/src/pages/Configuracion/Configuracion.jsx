import { useEffect, useState } from 'react';
import { cuentaService } from '../../services/cuenta.service';
import { Alert, Loader, PoliticaContrasena } from '../../components/common';
import { useNotification } from '../../hooks/useNotification';
import { validarPoliticaContrasena } from '../../utils/politicaContrasena';
import '../../styles/page-header.css';
import './Configuracion.css';

// SCRUM-237 a 239: "Configuración de usuario". Se llega desde el bloque de usuario
// del menú lateral. El único dato editable es el correo (la tabla de usuarios no
// tiene nombre ni teléfono) y la contraseña se cambia pidiendo la actual.
const mensajeError = (err, fallback) => err?.response?.data?.message || fallback;

const Configuracion = () => {
  const { notify } = useNotification();

  const [cuenta, setCuenta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [correo, setCorreo] = useState('');
  const [claveCorreo, setClaveCorreo] = useState('');
  const [errorCorreo, setErrorCorreo] = useState(null);
  const [guardandoCorreo, setGuardandoCorreo] = useState(false);

  const [claveActual, setClaveActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [mostrarClaves, setMostrarClaves] = useState(false);
  const [errorClave, setErrorClave] = useState(null);
  const [guardandoClave, setGuardandoClave] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);

    cuentaService
      .get()
      .then((data) => {
        if (!activo) return;
        setCuenta(data);
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

  const guardarCorreo = async (evento) => {
    evento.preventDefault();
    setErrorCorreo(null);
    setGuardandoCorreo(true);

    try {
      const actualizada = await cuentaService.actualizarCorreo({ correo, contrasenaActual: claveCorreo });
      setCuenta(actualizada);
      setCorreo(actualizada?.correo ?? '');
      setClaveCorreo('');
      notify('Correo actualizado correctamente.');
    } catch (err) {
      setErrorCorreo(mensajeError(err, 'No se pudo actualizar el correo. Intenta de nuevo.'));
    } finally {
      setGuardandoCorreo(false);
    }
  };

  const cambiarClave = async (evento) => {
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

    setGuardandoClave(true);
    try {
      await cuentaService.cambiarContrasena({
        contrasenaActual: claveActual,
        nuevaContrasena: nueva,
        confirmacion,
      });
      setClaveActual('');
      setNueva('');
      setConfirmacion('');
      notify('Tu contraseña se cambió correctamente.');
    } catch (err) {
      setErrorClave(mensajeError(err, 'No se pudo cambiar la contraseña. Intenta de nuevo.'));
    } finally {
      setGuardandoClave(false);
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
          <p>Revisá tus datos de acceso, actualizá tu correo y cambiá tu contraseña.</p>
        </div>
      </div>

      <div className="configuracion">
        <section className="configuracion-card">
          <h3>Datos de la cuenta</h3>

          <div className="configuracion-datos">
            <div className="configuracion-dato">
              <span className="configuracion-dato-label">Usuario</span>
              <span className="configuracion-dato-valor">{cuenta?.nombreUsuario}</span>
            </div>
            <div className="configuracion-dato">
              <span className="configuracion-dato-label">Rol</span>
              <span className="configuracion-dato-valor">{cuenta?.rol || '—'}</span>
            </div>
            {cuenta?.esAdmin && (
              <div className="configuracion-dato">
                <span className="configuracion-dato-label">Permisos</span>
                <span className="configuracion-dato-valor">Administrador</span>
              </div>
            )}
          </div>

          <p className="configuracion-nota">
            El usuario y el rol los cambia un administrador. El correo es el que se usa para recuperar la contraseña.
          </p>

          {errorCorreo && <Alert type="error">{errorCorreo}</Alert>}

          <form className="configuracion-form" onSubmit={guardarCorreo} noValidate>
            <div className="configuracion-campo">
              <label htmlFor="correo">Correo electrónico</label>
              <input
                id="correo"
                name="correo"
                type="email"
                autoComplete="email"
                placeholder="tu.correo@peredent.com"
                value={correo}
                onChange={(evento) => setCorreo(evento.target.value)}
              />
            </div>

            <div className="configuracion-campo">
              <label htmlFor="clave-correo">Tu contraseña actual (para confirmar)</label>
              <input
                id="clave-correo"
                name="clave-correo"
                type="password"
                autoComplete="current-password"
                value={claveCorreo}
                onChange={(evento) => setClaveCorreo(evento.target.value)}
              />
            </div>

            <div className="configuracion-acciones">
              <button type="submit" className="btn btn-primary btn-md" disabled={guardandoCorreo}>
                {guardandoCorreo ? 'Guardando…' : 'Guardar correo'}
              </button>
            </div>
          </form>
        </section>

        <section className="configuracion-card">
          <h3>Cambiar contraseña</h3>

          {errorClave && <Alert type="error">{errorClave}</Alert>}

          <form className="configuracion-form" onSubmit={cambiarClave} noValidate>
            <div className="configuracion-campo">
              <label htmlFor="clave-actual">Contraseña actual</label>
              <div className="configuracion-clave">
                <input
                  id="clave-actual"
                  name="clave-actual"
                  type={mostrarClaves ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={claveActual}
                  onChange={(evento) => setClaveActual(evento.target.value)}
                />
                <button type="button" className="configuracion-ver" onClick={() => setMostrarClaves((valor) => !valor)}>
                  {mostrarClaves ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <div className="configuracion-campo">
              <label htmlFor="clave-nueva">Contraseña nueva</label>
              <input
                id="clave-nueva"
                name="clave-nueva"
                type={mostrarClaves ? 'text' : 'password'}
                autoComplete="new-password"
                value={nueva}
                onChange={(evento) => setNueva(evento.target.value)}
              />
            </div>

            <div className="configuracion-campo">
              <label htmlFor="clave-confirmacion">Confirmá la contraseña nueva</label>
              <input
                id="clave-confirmacion"
                name="clave-confirmacion"
                type={mostrarClaves ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmacion}
                onChange={(evento) => setConfirmacion(evento.target.value)}
              />
            </div>

            <PoliticaContrasena />

            <div className="configuracion-acciones">
              <button type="submit" className="btn btn-primary btn-md" disabled={guardandoClave}>
                {guardandoClave ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Configuracion;
