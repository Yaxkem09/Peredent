import { createContext, useCallback, useMemo, useState, useEffect } from 'react';
import { authService } from '../services/auth.service';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { SessionExpiredModal } from '../components/common';

export const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (authService.isAuthenticated()) {
      setUser(authService.getUsuarioActual());
    }
    setIsLoading(false);
  }, []);

  const login = async ({ usuario, clave }) => {
    const data = await authService.login({ usuario, clave });
    setUser({ idUsuario: data.idUsuario, usuario: data.usuario, rol: data.rol, esAdmin: data.esAdmin });
    return data;
  };

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setSessionExpired(false);
  }, []);

  // Único disparador del aviso de sesión expirada: 10 minutos sin ningún
  // clic/tecla/scroll. El logout ya pasa en ese momento (no cuando se cierra
  // el modal); el botón del modal solo lo cierra para dejar ver el login,
  // a donde ProtectedRoute ya redirigió porque isAuthenticated pasó a false.
  const handleIdle = useCallback(() => {
    authService.logout();
    setUser(null);
    setSessionExpired(true);
  }, []);

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

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredModal open={sessionExpired} onClose={() => setSessionExpired(false)} />
    </AuthContext.Provider>
  );
};
