import { useEffect, useMemo, useState } from 'react';
import { usuariosService } from '../../services/usuarios.service';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Alert, Button, EmptyState, Loader, Modal } from '../../components/common';
import '../../styles/page-header.css';
import './AdministracionUsuarios.css';

const FORM_INICIAL = { nombreUsuario: '', correo: '', clave: '', idRol: '', esAdmin: false };

// Misma regla que valida el backend (algo@dominio.ext).
const FORMATO_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const mensajeError = (err, fallback) => err?.response?.data?.message || fallback;

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'activos', label: 'Activos' },
  { id: 'inactivos', label: 'Inactivos' },
  { id: 'admins', label: 'Administradores' },
];

const inicialesDe = (nombre) => (nombre || '?').slice(0, 2).toUpperCase();

// Rol -> modificador de color del avatar y del badge de rol.
const claseDeRol = (rol) => {
  const r = (rol || '').toLowerCase();
  if (r.startsWith('odont')) return 'rol-odontologo';
  if (r.startsWith('asist')) return 'rol-asistente';
  return 'rol-otro';
};

const Icono = ({ children, size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const ICONOS = {
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="7" r="2.4" />
      <path d="M15 20c0-2.6 1.7-4.5 4-4.9" />
    </>
  ),
  activo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  inactivo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 18L18 6" />
    </>
  ),
  escudo: <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
};

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

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');

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

    const correo = formulario.correo.trim();

    if (!formulario.nombreUsuario.trim() || !correo || !formulario.clave.trim() || !formulario.idRol) {
      setErrorCrear('Completa usuario, correo, contraseña y rol antes de guardar.');
      return;
    }

    if (!FORMATO_CORREO.test(correo)) {
      setErrorCrear('Ingresa un correo electrónico válido (ej. nombre@correo.com).');
      return;
    }

    setCreando(true);
    try {
      const nuevo = await usuariosService.create({
        nombreUsuario: formulario.nombreUsuario.trim(),
        correo,
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

  const resumen = useMemo(
    () => [
      { id: 'total', label: 'Usuarios registrados', valor: usuarios.length, icono: ICONOS.usuarios },
      { id: 'activos', label: 'Activos', valor: usuarios.filter((u) => u.estado).length, icono: ICONOS.activo },
      { id: 'inactivos', label: 'Inactivos', valor: usuarios.filter((u) => !u.estado).length, icono: ICONOS.inactivo },
      { id: 'admins', label: 'Administradores', valor: usuarios.filter((u) => u.esAdmin).length, icono: ICONOS.escudo },
    ],
    [usuarios],
  );

  const usuariosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (filtro === 'activos' && !u.estado) return false;
      if (filtro === 'inactivos' && u.estado) return false;
      if (filtro === 'admins' && !u.esAdmin) return false;
      if (!termino) return true;
      return [u.nombreUsuario, u.correo, u.rol].some((campo) => (campo || '').toLowerCase().includes(termino));
    });
  }, [usuarios, busqueda, filtro]);

  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Solo administradores</div>
          <h2>Administración de usuarios</h2>
          <p>Creá cuentas para el personal y gestioná quién puede acceder al sistema.</p>
        </div>
        <Button variant="primary" className="admin-nuevo" onClick={abrirModal}>
          <Icono>{ICONOS.mas}</Icono>
          Nuevo usuario
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
        <>
          <div className="admin-stats">
            {resumen.map((item) => (
              <div className={`admin-stat ${item.id}`} key={item.id}>
                <span className="admin-stat-icono">
                  <Icono size={20}>{item.icono}</Icono>
                </span>
                <div>
                  <div className="admin-stat-num">{item.valor}</div>
                  <div className="admin-stat-label">{item.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="users-table-wrap">
            <div className="admin-toolbar">
              <label className="admin-buscar">
                <Icono>{ICONOS.buscar}</Icono>
                <input
                  type="search"
                  placeholder="Buscar por usuario, correo o rol"
                  aria-label="Buscar usuarios"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </label>
              <div className="admin-filtros" role="group" aria-label="Filtrar usuarios">
                {FILTROS.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    className={filtro === f.id ? 'active' : ''}
                    onClick={() => setFiltro(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <table className="users-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Admin</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="users-table-sin-resultados">
                      Ningún usuario coincide con la búsqueda.
                    </td>
                  </tr>
                )}
                {usuariosFiltrados.map((usuario) => {
                  const esActual = esUsuarioActual(usuario);
                  const procesando = accionEnCurso === usuario.id;
                  const tituloBloqueo = esActual ? 'No podés modificar tu propio usuario.' : undefined;

                  return (
                    <tr key={usuario.id} className={usuario.estado ? undefined : 'fila-inactiva'}>
                      <td>
                        <div className="users-table-usuario">
                          <span className={`users-avatar ${claseDeRol(usuario.rol)}`}>
                            {inicialesDe(usuario.nombreUsuario)}
                          </span>
                          <span className="users-table-nombre">
                            {usuario.nombreUsuario}
                            {esActual && <span className="users-tu">Tú</span>}
                          </span>
                        </div>
                      </td>
                      <td className={usuario.correo ? undefined : 'users-table-vacio'}>
                        {usuario.correo || 'Sin correo'}
                      </td>
                      <td>
                        <span className={`badge badge-rol ${claseDeRol(usuario.rol)}`}>{usuario.rol}</span>
                      </td>
                      <td>
                        <span className={`badge ${usuario.estado ? 'badge-activo' : 'badge-inactivo'}`}>
                          <span className="badge-punto" />
                          {usuario.estado ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        {usuario.esAdmin ? (
                          <span className="badge badge-admin">
                            <Icono size={13}>{ICONOS.escudo}</Icono>
                            Admin
                          </span>
                        ) : (
                          <span className="users-table-vacio">—</span>
                        )}
                      </td>
                      <td>
                        <div className="users-table-acciones">
                          <button
                            type="button"
                            className={`admin-accion ${usuario.estado ? 'peligro' : 'exito'}`}
                            disabled={esActual || procesando}
                            title={tituloBloqueo}
                            onClick={() => toggleEstado(usuario)}
                          >
                            <Icono size={15}>{usuario.estado ? ICONOS.inactivo : ICONOS.activo}</Icono>
                            {usuario.estado ? 'Deshabilitar' : 'Habilitar'}
                          </button>
                          <button
                            type="button"
                            className={`admin-accion ${usuario.esAdmin ? 'neutra' : 'admin'}`}
                            disabled={esActual || procesando}
                            title={tituloBloqueo}
                            onClick={() => toggleAdmin(usuario)}
                          >
                            <Icono size={15}>{ICONOS.escudo}</Icono>
                            {usuario.esAdmin ? 'Quitar admin' : 'Dar admin'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
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
            <label htmlFor="correo">Correo electrónico</label>
            <input
              id="correo"
              name="correo"
              type="email"
              autoComplete="off"
              placeholder="Ej. jperez@correo.com"
              value={formulario.correo}
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
