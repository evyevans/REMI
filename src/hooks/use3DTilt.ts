import { useState, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

interface TiltConfig {
  max: number; // Max tilt rotation (degrees)
  perspective: number; // Transform perspective (px)
  scale: number; // Hover scale
  speed: number; // Transition speed (ms)
}

const DEFAULT_CONFIG: TiltConfig = {
  max: 5,
  perspective: 1000,
  scale: 1.02,
  speed: 400,
};

export function use3DTilt(config: Partial<TiltConfig> = {}) {
  const { max, perspective, scale, speed } = { ...DEFAULT_CONFIG, ...config };
  
  const [style, setStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLElement>(null);
  
  const onMouseMove = (e: ReactMouseEvent<HTMLElement> | globalThis.MouseEvent) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -max;
    const rotateY = ((x - centerX) / centerX) * max;
    
    setStyle({
      transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`,
      transition: 'none',
    });
  };
  
  const onMouseLeave = () => {
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
      transition: `transform ${speed}ms cubic-bezier(0.23, 1, 0.32, 1)`,
    });
  };

  const onMouseEnter = () => {
    setStyle(prev => ({ ...prev, transition: `transform ${speed}ms cubic-bezier(0.23, 1, 0.32, 1)` }));
  };

  return { ref, style, onMouseMove, onMouseLeave, onMouseEnter };
}
