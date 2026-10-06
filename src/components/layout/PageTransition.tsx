import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.animate([
      { opacity: 0, transform: 'translateX(10px)' },
      { opacity: 1, transform: 'translateX(0px)' }
    ], { duration: 220, easing: 'cubic-bezier(0,0,0.2,1)', fill: 'forwards' });
  }, [location.pathname]);

  return (
    <div
      ref={ref}
      className="page-transition min-h-full w-full flex flex-col relative"
    >
      {children}
    </div>
  );
}
