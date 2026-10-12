import { useState } from 'react';
import { recetarioService } from '../../services/recetario.service';
import { Alert, Button, Modal } from '../../components/common';

const CAMPOS = [
  { nombre: 'nombres', label: 'Nombres', max: 100 },
  { nombre: 'apellidos', label: 'Apellidos', max: 100 },
  { nombre: 'colegiado', label: 'No. de colegiado', max: 50 },
  { nombre: 'telefono', label: 'Teléfono', max: 20, tipo: 'tel' },
  { nombre: 'correo', label: 'Correo', max: 150, tipo: 'email' },
  { nombre: 'direccion', label: 'Dirección de la clínica', max: 200, completo: true },
];

const VACIO = { nombres: '', apellidos: '', colegiado: '', telefono: '', correo: '', direccion: '' };

// SCRUM-294: datos profesionales del odontólogo en sesión (los mismos que
// encabezan sus recetas). Permite registrarlos sin emitir una receta para
// poder firmar constancias. Guardar crea una versión nueva: las recetas ya
// emitidas conservan los datos con los que salieron.
const DatosProfesionalesModal = ({ open, datosIniciales, onCerrar, onGuardado }) => {
  const [form, setForm] = useState(() => ({ ...VACIO, ...datosIniciales }));
  const [invalidos, setInvalidos] = useState([]);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => {
    const valor = e.target.value;
    setForm((f) => ({ ...f, [campo]: valor }));
    if (invalidos.includes(campo)) setInvalidos((prev) => prev.filter((c) => c !== campo));
  };

  const guardar = async () => {
    const faltantes = CAMPOS.filter((c) => !form[c.nombre]?.trim()).map((c) => c.nombre);
    if (faltantes.length > 0) {
      setInvalidos(faltantes);
      setError('Completa todos los datos profesionales.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const datos = await recetarioService.guardarPerfilOdontologo(form);
      onGuardado(datos);
    } catch (err) {
      const campos = err.response?.data?.campos;
      if (Array.isArray(campos)) setInvalidos(campos);
      setError(err.response?.data?.message || 'No se pudieron guardar tus datos. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !guardando && onCerrar()}
      wide
      title="Mis datos profesionales"
      footer={
        <>
          <Button variant="secondary" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} loading={guardando}>
            Guardar datos
          </Button>
        </>
      }
    >
      <div className="constancia-datos">
        <p className="constancia-datos-intro">
          Estos datos aparecen en la firma de tus constancias y se precargan en tus recetas. Si los cambias, las
          constancias salen con los datos nuevos.
        </p>

        {error && <Alert type="error">{error}</Alert>}

        <div className="constancia-datos-grid">
          {CAMPOS.map((c) => (
            <div className={`constancia-datos-campo${c.completo ? ' completo' : ''}`} key={c.nombre}>
              <label htmlFor={`dp-${c.nombre}`}>
                {c.label} <span className="constancia-datos-requerido">*</span>
              </label>
              <input
                id={`dp-${c.nombre}`}
                type={c.tipo || 'text'}
                className={invalidos.includes(c.nombre) ? 'invalido' : ''}
                value={form[c.nombre]}
                onChange={cambiar(c.nombre)}
                maxLength={c.max}
                disabled={guardando}
              />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default DatosProfesionalesModal;
