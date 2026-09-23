import { useEffect, useState } from 'react';
import { recetarioService } from '../../services/recetario.service';
import { Alert } from '../../components/common';
import { formatDate, formatTime } from '../../utils/formatters';
import { IconUser, IconPill, IconNote, IconInfo, IconPlus, IconTrash } from './RecetarioIcons';
import './Recetario.css';

const medicamentoVacio = () => ({ nombre: '', presentacion: '', indicaciones: '' });

const perfilVacio = () => ({
  nombres: '',
  apellidos: '',
  colegiado: '',
  direccion: '',
  telefono: '',
  correo: '',
});

// Formulario para crear una receta. Solo necesita a qué paciente es
// (idPaciente/nombrePaciente) — se usa igual desde la pestaña "Recetario" del
// expediente (donde el paciente ya se conoce) que desde el menú principal
// (donde primero se elige con un buscador).
const RecetaForm = ({ idPaciente, nombrePaciente, onCreada, onCancelar }) => {
  const [perfil, setPerfil] = useState(perfilVacio());
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [medicamentos, setMedicamentos] = useState([medicamentoVacio()]);
  const [otrasIndicaciones, setOtrasIndicaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(null);

  useEffect(() => {
    let activo = true;
    setCargandoPerfil(true);

    recetarioService
      .getPerfilOdontologo()
      .then((data) => {
        if (activo) setPerfil(data || perfilVacio());
      })
      .catch(() => {
        if (activo) setPerfil(perfilVacio());
      })
      .finally(() => {
        if (activo) setCargandoPerfil(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  const agregarMedicamento = () => setMedicamentos((prev) => [...prev, medicamentoVacio()]);
  const eliminarMedicamento = (i) => setMedicamentos((prev) => prev.filter((_, idx) => idx !== i));
  const actualizarMedicamento = (i, campo, valor) =>
    setMedicamentos((prev) => prev.map((m, idx) => (idx === i ? { ...m, [campo]: valor } : m)));

  const guardarReceta = async () => {
    const medicamentosValidos = medicamentos
      .map((m) => ({ ...m, nombre: m.nombre.trim() }))
      .filter((m) => m.nombre);

    if (medicamentosValidos.length === 0) {
      setErrorGuardar('Agrega al menos un medicamento con nombre.');
      return;
    }

    if (!perfil.nombres.trim() || !perfil.apellidos.trim() || !perfil.colegiado.trim()
      || !perfil.direccion.trim() || !perfil.telefono.trim() || !perfil.correo.trim()) {
      setErrorGuardar('Completa los datos del odontólogo y la clínica antes de guardar.');
      return;
    }

    setGuardando(true);
    setErrorGuardar(null);
    try {
      const nueva = await recetarioService.crear(idPaciente, {
        odontologo: {
          nombres: perfil.nombres.trim(),
          apellidos: perfil.apellidos.trim(),
          colegiado: perfil.colegiado.trim(),
          direccion: perfil.direccion.trim(),
          telefono: perfil.telefono.trim(),
          correo: perfil.correo.trim(),
        },
        medicamentos: medicamentosValidos,
        notasAdicionales: otrasIndicaciones.trim() || null,
      });
      onCreada(nueva);
    } catch {
      setErrorGuardar('No se pudo guardar la receta. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const ahora = new Date();

  return (
    <div className="receta-form info-card">
      {errorGuardar && <Alert type="error">{errorGuardar}</Alert>}

      <div className="receta-form-header">
        <strong>Nueva receta médica</strong>
        <p className="receta-subtitle">
          Paciente: {nombrePaciente || '—'} · Fecha de emisión: {formatDate(ahora)} {formatTime(ahora)}
        </p>
      </div>

      <div className="receta-section">
        <div className="receta-section-titulo">
          <span className="receta-section-icono receta-section-icono-odontologo">
            <IconUser />
          </span>
          Datos del odontólogo y la clínica
        </div>
        <div className="receta-grid-2">
          <label className="receta-campo">
            Nombres
            <input
              type="text"
              value={perfil.nombres}
              disabled={cargandoPerfil}
              onChange={(e) => setPerfil((p) => ({ ...p, nombres: e.target.value }))}
            />
          </label>
          <label className="receta-campo">
            Apellidos
            <input
              type="text"
              value={perfil.apellidos}
              disabled={cargandoPerfil}
              onChange={(e) => setPerfil((p) => ({ ...p, apellidos: e.target.value }))}
            />
          </label>
          <label className="receta-campo">
            No. de colegiado
            <input
              type="text"
              value={perfil.colegiado}
              disabled={cargandoPerfil}
              onChange={(e) => setPerfil((p) => ({ ...p, colegiado: e.target.value }))}
            />
          </label>
          <label className="receta-campo">
            Teléfono
            <input
              type="text"
              value={perfil.telefono}
              disabled={cargandoPerfil}
              onChange={(e) => setPerfil((p) => ({ ...p, telefono: e.target.value }))}
            />
          </label>
          <label className="receta-campo receta-campo-full">
            Dirección (clínica)
            <input
              type="text"
              value={perfil.direccion}
              disabled={cargandoPerfil}
              onChange={(e) => setPerfil((p) => ({ ...p, direccion: e.target.value }))}
            />
          </label>
          <label className="receta-campo receta-campo-full">
            Correo electrónico
            <input
              type="email"
              value={perfil.correo}
              disabled={cargandoPerfil}
              onChange={(e) => setPerfil((p) => ({ ...p, correo: e.target.value }))}
            />
          </label>
        </div>
        <div className="receta-info-banner">
          <IconInfo />
          <span>Estos datos quedan guardados en tu cuenta y se precargan en tus próximas recetas.</span>
        </div>
      </div>

      <div className="receta-section">
        <div className="receta-section-titulo">
          <span className="receta-section-icono receta-section-icono-medicamento">
            <IconPill />
          </span>
          Medicamentos
        </div>
        <div className="receta-medicamentos-form">
          {medicamentos.map((m, i) => (
            <div className="receta-medicamento-row" key={i}>
              <span className="receta-medicamento-row-num">{i + 1}</span>
              <input
                type="text"
                placeholder="Nombre del medicamento"
                value={m.nombre}
                onChange={(e) => actualizarMedicamento(i, 'nombre', e.target.value)}
              />
              <input
                type="text"
                placeholder="Presentación (ej. 500 mg, tableta)"
                value={m.presentacion}
                onChange={(e) => actualizarMedicamento(i, 'presentacion', e.target.value)}
              />
              <input
                type="text"
                placeholder="Indicaciones (dosis, frecuencia, duración)"
                value={m.indicaciones}
                onChange={(e) => actualizarMedicamento(i, 'indicaciones', e.target.value)}
              />
              <button
                type="button"
                className="receta-btn-remove"
                onClick={() => eliminarMedicamento(i)}
                disabled={medicamentos.length === 1}
                aria-label="Quitar medicamento"
                title="Quitar medicamento"
              >
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-outline-teal btn-sm" onClick={agregarMedicamento}>
          <IconPlus /> Agregar medicamento
        </button>
      </div>

      <div className="receta-section">
        <div className="receta-section-titulo">
          <span className="receta-section-icono receta-section-icono-nota">
            <IconNote />
          </span>
          Otras indicaciones
        </div>
        <textarea
          rows={3}
          value={otrasIndicaciones}
          onChange={(e) => setOtrasIndicaciones(e.target.value)}
          placeholder="Indicaciones adicionales para el paciente"
        />
      </div>

      <div className="detail-actions">
        <button type="button" className="btn btn-primary btn-md" onClick={guardarReceta} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar receta'}
        </button>
        <button type="button" className="btn btn-secondary btn-md" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </div>
  );
};

export default RecetaForm;
