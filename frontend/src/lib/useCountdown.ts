import { useCallback, useEffect, useState } from 'react';

/** Seconds left until an action is allowed again (OTP resend cooldown, spec 4.3). */
export function useCountdown(initialSeconds: number) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + initialSeconds * 1000);
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const restart = useCallback((seconds: number) => setEndsAt(Date.now() + seconds * 1000), []);

  return { remaining, restart };
}
