import { createContext, useCallback, useRef, useState } from 'react';
import Toast from '../components/common/Toast';

export const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  const notify = useCallback((message) => {
    clearTimeout(timeoutRef.current);
    setToast({ message });
    timeoutRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <Toast toast={toast} />
    </NotificationContext.Provider>
  );
};
