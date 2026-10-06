/* ═══════════════════════════════════════════════════════════
   Aceternity UI — Text Hover Effect
   Original: https://ui.aceternity.com/components/text-hover-effect
   ═══════════════════════════════════════════════════════════ */

"use client";
import React, { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";

export interface TextHoverEffectProps {
  text: string;
  duration?: number;
  className?: string;
  strokeColor?: string;
  viewBox?: string;
}

export function TextHoverEffect({
  text,
  className,
  strokeColor = "currentColor",
  viewBox = "0 0 1000 100",
}: TextHoverEffectProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      setMaskPosition({ cx: `${nx * 100}%`, cy: `${ny * 100}%` });
    },
    []
  );

  const gradientId = `remi-tge-gradient-${text.replaceAll(" ", "")}`;
  const maskId = `remi-tge-mask-${text.replaceAll(" ", "")}`;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
      className={`select-none ${className ?? ""}`}
      style={{ cursor: "default" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8733A" />
          <stop offset="40%" stopColor="#C19932" />
          <stop offset="100%" stopColor="#4A9E6B" />
        </linearGradient>
        <motion.radialGradient
          id={maskId}
          r="35%"
          gradientUnits="userSpaceOnUse"
          animate={
            hovered
              ? { cx: maskPosition.cx, cy: maskPosition.cy }
              : { cx: ["-20%", "120%", "-20%"], cy: ["50%", "50%", "50%"] }
          }
          transition={
            hovered
              ? { type: "spring", stiffness: 300, damping: 20 }
              : { duration: 6, repeat: Infinity, ease: "linear" }
          }
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id={`${maskId}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${maskId})`} />
        </mask>
      </defs>

      {/* Outline (rest state) */}
      <text
        x="50%"
        y="55%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke={strokeColor}
        strokeWidth="0.6"
        strokeOpacity="0.25"
        fill="currentColor"
        fillOpacity="0.9"
        fontSize="60"
        fontWeight="700"
        fontFamily="Inter, -apple-system, sans-serif"
        letterSpacing="4"
      >
        {text}
      </text>

      {/* Gradient fill — revealed on hover radius */}
      <motion.text
        x="50%"
        y="55%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={`url(#${gradientId})`}
        stroke="transparent"
        fontSize="60"
        fontWeight="700"
        fontFamily="Inter, -apple-system, sans-serif"
        letterSpacing="4"
        mask={`url(#${maskId}-mask)`}
        strokeWidth="0"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {text}
      </motion.text>
    </svg>
  );
}

export default TextHoverEffect;
