import './Toast.css';

const Toast = ({ toast }) => {
  return (
    <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
      {toast?.message}
    </div>
  );
};

export default Toast;
