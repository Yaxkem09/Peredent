import { createContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth.service';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const logout = () => {
    authService.logout();
    setUser(null);
  };

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
