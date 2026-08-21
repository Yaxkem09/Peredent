import './EmptyState.css';

const EmptyState = ({ title, description, icon, action }) => {
  return (
    <div className="empty-state-block">
      {icon && <div className="empty-state-icon">{icon}</div>}
      {title && <h3 className="empty-state-title">{title}</h3>}
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
};

export default EmptyState;
