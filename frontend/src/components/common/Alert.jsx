import './Alert.css';

const Alert = ({ type = 'info', children }) => {
  return (
    <div className={`alert alert-${type}`} role="status">
      {children}
    </div>
  );
};

export default Alert;
