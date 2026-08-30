import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Loader from '../components/common/Loader';

const PermissionRoute = ({ allow }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <Loader fullscreen />;
  }

  if (!allow(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default PermissionRoute;
