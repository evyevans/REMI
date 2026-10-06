import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
}

/**
 * Portal component that renders children into a div appended to document.body.
 * Ensures that dropdowns and modals are not clipped by parent containers with overflow: hidden.
 */
export function Portal({ children }: PortalProps) {
  const [mounted, setMounted] = useState(false);
  const [container] = useState(() => {
    const div = document.createElement('div');
    div.id = 'remi-portal-root';
    return div;
  });

  useEffect(() => {
    setMounted(true);
    document.body.appendChild(container);
    return () => {
      document.body.removeChild(container);
    };
  }, [container]);

  if (!mounted) return null;

  return createPortal(children, container);
}
