import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth.service';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { useNotification } from '../hooks/useNotification';

export const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { notify } = useNotification();

  useEffect(() => {
    if (authService.isAuthenticated()) {
      setUser(authService.getUsuarioActual());
    }
    setIsLoading(false);
  }, []);

  const login = async ({ usuario, clave }) => {
    const data = await authService.login({ usuario, clave });
    setUser({ usuario: data.usuario, rol: data.rol, esAdmin: data.esAdmin });
    return data;
  };

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const handleIdle = useCallback(() => {
    logout();
    notify('Sesión cerrada por inactividad');
  }, [logout, notify]);

  useIdleTimer(handleIdle, { timeout: INACTIVITY_TIMEOUT_MS, enabled: Boolean(user) });

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
