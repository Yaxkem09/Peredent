import Modal from './Modal';

// Pop-up de cambios sin guardar (SCRUM-284 / SCRUM-285). Recibe lo que devuelve
// useAvisoCambiosSinGuardar.
const AvisoCambiosSinGuardar = ({ open, guardando, onGuardarYSalir, onCancelar }) => (
  <Modal
    open={open}
    onClose={() => !guardando && onCancelar()}
    title="Tiene cambios sin guardar. ¿Desea guardarlos antes de salir?"
    icon={
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4M12 16.5h.01" />
        <path d="M10.3 4.3 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      </svg>
    }
    footer={
      <>
        <button type="button" className="btn btn-secondary btn-md" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary btn-md" onClick={onGuardarYSalir} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar y salir'}
        </button>
      </>
    }
  />
);

export default AvisoCambiosSinGuardar;
