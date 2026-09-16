import Modal from './Modal';
import Button from './Button';

const IconoReloj = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 2" />
  </svg>
);

const SessionExpiredModal = ({ open, onClose }) => (
  <Modal
    open={open}
    onClose={onClose}
    icon={<IconoReloj />}
    title="Sesión expirada"
    footer={
      <Button variant="primary" onClick={onClose}>
        Iniciar sesión de nuevo
      </Button>
    }
  >
    <p>Tu sesión se cerró por inactividad. Iniciá sesión de nuevo para seguir usando el sistema.</p>
  </Modal>
);

export default SessionExpiredModal;
