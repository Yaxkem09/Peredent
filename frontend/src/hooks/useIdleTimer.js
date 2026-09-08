import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'];

export const useIdleTimer = (onIdle, { timeout, enabled = true } = {}) => {
  const timerRef = useRef(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const resetTimer = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onIdleRef.current(), timeout);
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [timeout, enabled]);
};
