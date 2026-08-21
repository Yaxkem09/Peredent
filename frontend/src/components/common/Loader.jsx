import './Loader.css';

const Loader = ({ size = 'md', fullscreen = false, label }) => {
  const spinner = (
    <span className={`loader loader-${size}`} role="status" aria-label={label || 'Cargando'} />
  );

  if (!fullscreen) return spinner;

  return (
    <div className="loader-fullscreen">
      {spinner}
      {label && <p className="loader-label">{label}</p>}
    </div>
  );
};

export default Loader;
