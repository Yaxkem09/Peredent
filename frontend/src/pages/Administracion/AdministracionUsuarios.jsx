import { useEffect, useState } from 'react';
import { usuariosService } from '../../services/usuarios.service';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Alert, Button, EmptyState, Loader, Modal } from '../../components/common';
import '../../styles/page-header.css';
import './AdministracionUsuarios.css';

const FORM_INICIAL = { nombreUsuario: '', clave: '', idRol: '', esAdmin: false };

const mensajeError = (err, fallback) => err?.response?.data?.message || fallback;

const AdministracionUsuarios = () => {
  const { user } = useAuth();
  const { notify } = useNotification();

  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [roles, setRoles] = useState([]);
  const [cargandoRoles, setCargandoRoles] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [formulario, setFormulario] = useState(FORM_INICIAL);
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState(null);

  const [accionEnCurso, setAccionEnCurso] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);

  const [usuarioAConfirmarAdmin, setUsuarioAConfirmarAdmin] = useState(null);
  const [otorgandoAdmin, setOtorgandoAdmin] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    usuariosService
      .getAll()
      .then((data) => { if (activo) setUsuarios(data); })
      .catch(() => { if (activo) setError('No se pudo cargar la lista de usuarios.'); })
      .finally(() => { if (activo) setCargando(false); });

    return () => {
      activo = false;
    };
  }, []);

  const abrirModal = () => {
    setErrorCrear(null);
    setFormulario(FORM_INICIAL);
    setModalAbierto(true);

    if (roles.length === 0 && !cargandoRoles) {
      setCargandoRoles(true);
      usuariosService
        .getRoles()
        .then(setRoles)
        .catch(() => setErrorCrear('No se pudo cargar la lista de roles.'))
        .finally(() => setCargandoRoles(false));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormulario((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const guardarUsuario = async () => {
    setErrorCrear(null);

    if (!formulario.nombreUsuario.trim() || !formulario.clave.trim() || !formulario.idRol) {
      setErrorCrear('Completa usuario, contraseña y rol antes de guardar.');
      return;
    }

    setCreando(true);
    try {
      const nuevo = await usuariosService.create({
        nombreUsuario: formulario.nombreUsuario.trim(),
        clave: formulario.clave,
        idRol: Number(formulario.idRol),
        esAdmin: formulario.esAdmin,
      });
      setUsuarios((prev) => [...prev, nuevo].sort((a, b) => a.nombreUsuario.localeCompare(b.nombreUsuario)));
      notify('Usuario creado exitosamente.');
      setModalAbierto(false);
    } catch (err) {
      setErrorCrear(mensajeError(err, 'No se pudo crear el usuario. Intenta de nuevo.'));
    } finally {
      setCreando(false);
    }
  };

  const actualizarUsuario = (actualizado) => {
    setUsuarios((prev) => prev.map((u) => (u.id === actualizado.id ? actualizado : u)));
  };

  const toggleEstado = async (usuario) => {
    setErrorAccion(null);
    setAccionEnCurso(usuario.id);
    try {
      const actualizado = usuario.estado
        ? await usuariosService.deshabilitar(usuario.id)
        : await usuariosService.habilitar(usuario.id);
      actualizarUsuario(actualizado);
    } catch (err) {
      setErrorAccion(mensajeError(err, 'No se pudo actualizar el estado del usuario.'));
    } finally {
      setAccionEnCurso(null);
    }
  };

  const toggleAdmin = async (usuario) => {
    // Otorgar admin es una acción sensible (el nuevo admin va a poder crear y
    // deshabilitar usuarios), así que se confirma antes de mandar el PATCH.
    // Esto es solo un freno a clics accidentales en la UI, NO es la seguridad
    // real del feature — eso ya lo garantiza la policy SoloAdmin del backend
    // (UsuariosController), que protege el endpoint sin importar qué haga el
    // frontend. Quitar admin no se confirma: solo se pidió para el otorgamiento.
    if (!usuario.esAdmin) {
      setUsuarioAConfirmarAdmin(usuario);
      return;
    }

    setErrorAccion(null);
    setAccionEnCurso(usuario.id);
    try {
      const actualizado = await usuariosService.revocarAdmin(usuario.id);
      actualizarUsuario(actualizado);
    } catch (err) {
      setErrorAccion(mensajeError(err, 'No se pudo actualizar el permiso de administrador.'));
    } finally {
      setAccionEnCurso(null);
    }
  };

  const confirmarOtorgarAdmin = async () => {
    const usuario = usuarioAConfirmarAdmin;
    if (!usuario) return;

    setErrorAccion(null);
    setOtorgandoAdmin(true);
    try {
      const actualizado = await usuariosService.otorgarAdmin(usuario.id);
      actualizarUsuario(actualizado);
    } catch (err) {
      setErrorAccion(mensajeError(err, 'No se pudo actualizar el permiso de administrador.'));
    } finally {
      setOtorgandoAdmin(false);
      setUsuarioAConfirmarAdmin(null);
    }
  };

  const esUsuarioActual = (usuario) => usuario.nombreUsuario === user?.usuario;

  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Solo administradores</div>
          <h2>Administración de usuarios</h2>
          <p>Creá cuentas para el personal y gestioná quién puede acceder al sistema.</p>
        </div>
        <Button variant="primary" onClick={abrirModal}>
          + Nuevo usuario
        </Button>
      </div>

      {errorAccion && <Alert type="error">{errorAccion}</Alert>}

      {cargando ? (
        <Loader />
      ) : error ? (
        <Alert type="error">{error}</Alert>
      ) : usuarios.length === 0 ? (
        <EmptyState
          title="Sin usuarios registrados"
          description="Los usuarios que crees van a aparecer en este listado."
        />
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Admin</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => {
                const esActual = esUsuarioActual(usuario);
                const procesando = accionEnCurso === usuario.id;
                const tituloBloqueo = esActual ? 'No podés modificar tu propio usuario.' : undefined;

                return (
                  <tr key={usuario.id}>
                    <td className="users-table-nombre">{usuario.nombreUsuario}</td>
                    <td>{usuario.rol}</td>
                    <td>
                      <span className={`badge ${usuario.estado ? 'badge-activo' : 'badge-inactivo'}`}>
                        {usuario.estado ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${usuario.esAdmin ? 'badge-admin' : 'badge-neutro'}`}>
                        {usuario.esAdmin ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td>
                      <div className="users-table-acciones">
                        <Button
                          variant={usuario.estado ? 'danger' : 'outline-teal'}
                          size="sm"
                          disabled={esActual || procesando}
                          title={tituloBloqueo}
                          onClick={() => toggleEstado(usuario)}
                        >
                          {usuario.estado ? 'Deshabilitar' : 'Habilitar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={esActual || procesando}
                          title={tituloBloqueo}
                          onClick={() => toggleAdmin(usuario)}
                        >
                          {usuario.esAdmin ? 'Quitar admin' : 'Dar admin'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalAbierto}
        onClose={() => !creando && setModalAbierto(false)}
        title="Nuevo usuario"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalAbierto(false)} disabled={creando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardarUsuario} loading={creando}>
              Crear usuario
            </Button>
          </>
        }
      >
        <div className="users-form">
          {errorCrear && <Alert type="error">{errorCrear}</Alert>}

          <div className="field">
            <label htmlFor="nombreUsuario">Usuario</label>
            <input
              id="nombreUsuario"
              name="nombreUsuario"
              type="text"
              placeholder="Ej. jperez"
              value={formulario.nombreUsuario}
              onChange={handleChange}
              disabled={creando}
            />
          </div>

          <div className="field">
            <label htmlFor="clave">Contraseña</label>
            <input
              id="clave"
              name="clave"
              type="password"
              placeholder="Contraseña inicial"
              value={formulario.clave}
              onChange={handleChange}
              disabled={creando}
            />
          </div>

          <div className="field">
            <label htmlFor="idRol">Rol</label>
            <select
              id="idRol"
              name="idRol"
              value={formulario.idRol}
              onChange={handleChange}
              disabled={creando || cargandoRoles}
            >
              <option value="">{cargandoRoles ? 'Cargando roles…' : 'Selecciona un rol'}</option>
              {roles.map((rol) => (
                <option key={rol.id} value={rol.id}>
                  {rol.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="users-form-checkbox">
            <input
              id="esAdmin"
              name="esAdmin"
              type="checkbox"
              checked={formulario.esAdmin}
              onChange={handleChange}
              disabled={creando}
            />
            <label htmlFor="esAdmin">Es administrador (puede gestionar usuarios)</label>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(usuarioAConfirmarAdmin)}
        onClose={() => !otorgandoAdmin && setUsuarioAConfirmarAdmin(null)}
        title="¿Dar permisos de administrador?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setUsuarioAConfirmarAdmin(null)}
              disabled={otorgandoAdmin}
            >
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmarOtorgarAdmin} loading={otorgandoAdmin}>
              Sí, dar admin
            </Button>
          </>
        }
      >
        ¿Seguro que querés dar permisos de administrador a{' '}
        <strong>{usuarioAConfirmarAdmin?.nombreUsuario}</strong>? Podrá crear y deshabilitar usuarios.
      </Modal>
    </div>
  );
};

export default AdministracionUsuarios;
