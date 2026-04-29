import React from 'react';

/**
 * Professional vehicle SVG icons (Uber/Bolt-style silhouettes)
 * Types: standard, premium, van
 */
export default function VehicleIcon({ type, className = '', active = false }) {
  const color = active ? '#00C2FF' : '#8B95A5';
  const accent = active ? '#00E5FF' : '#B8C1CC';

  if (type === 'premium') {
    // Sleek luxury sedan silhouette (Mercedes E-Class / BMW 5 style)
    return (
      <svg viewBox="0 0 64 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`premGrad-${active ? 'on' : 'off'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
            <stop offset="100%" stopColor={color} stopOpacity="1"/>
          </linearGradient>
        </defs>
        {/* Body */}
        <path d="M4 22 L8 14 C10 10 14 8 20 7 L44 7 C50 8 54 10 56 14 L60 22 L60 26 L4 26 Z"
              fill={`url(#premGrad-${active ? 'on' : 'off'})`} stroke={accent} strokeWidth="0.5"/>
        {/* Windows */}
        <path d="M14 13 L18 9 L38 9 L46 13 L44 15 L16 15 Z" fill="#0A1420" opacity="0.85"/>
        <path d="M32 9 L32 15" stroke={color} strokeWidth="0.4" opacity="0.6"/>
        {/* Headlight */}
        <circle cx="58" cy="17" r="1.2" fill="#FFF8DC"/>
        {/* Wheels */}
        <circle cx="16" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
        <circle cx="16" cy="26" r="2" fill="#2A2A2A"/>
        <circle cx="48" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
        <circle cx="48" cy="26" r="2" fill="#2A2A2A"/>
      </svg>
    );
  }

  if (type === 'van') {
    // Minivan / 7-seater silhouette (VW Sharan / Mercedes V-Class style)
    return (
      <svg viewBox="0 0 64 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`vanGrad-${active ? 'on' : 'off'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
            <stop offset="100%" stopColor={color} stopOpacity="1"/>
          </linearGradient>
        </defs>
        {/* Body – taller roof for van */}
        <path d="M4 24 L5 10 C5 8 7 7 10 7 L52 7 C56 7 58 9 59 12 L60 24 L60 26 L4 26 Z"
              fill={`url(#vanGrad-${active ? 'on' : 'off'})`} stroke={accent} strokeWidth="0.5"/>
        {/* Windows */}
        <path d="M9 11 L9 17 L27 17 L27 9 L12 9 Z" fill="#0A1420" opacity="0.85"/>
        <path d="M30 9 L30 17 L50 17 L49 11 L30 9 Z" fill="#0A1420" opacity="0.85"/>
        <path d="M29 9 L29 17" stroke={color} strokeWidth="0.4" opacity="0.6"/>
        {/* Headlight */}
        <rect x="57" y="16" width="2.5" height="2" rx="0.5" fill="#FFF8DC"/>
        {/* Wheels */}
        <circle cx="16" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
        <circle cx="16" cy="26" r="2" fill="#2A2A2A"/>
        <circle cx="48" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
        <circle cx="48" cy="26" r="2" fill="#2A2A2A"/>
      </svg>
    );
  }

  // Standard – compact hatchback/sedan (VW Golf / Toyota Prius style)
  return (
    <svg viewBox="0 0 64 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`stdGrad-${active ? 'on' : 'off'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={color} stopOpacity="1"/>
        </linearGradient>
      </defs>
      {/* Body */}
      <path d="M4 23 L9 15 C11 12 15 10 20 9 L42 9 C48 10 53 13 56 16 L60 23 L60 26 L4 26 Z"
            fill={`url(#stdGrad-${active ? 'on' : 'off'})`} stroke={accent} strokeWidth="0.5"/>
      {/* Windshield + rear window */}
      <path d="M14 15 L20 11 L38 11 L45 15 L43 17 L16 17 Z" fill="#0A1420" opacity="0.85"/>
      <path d="M30 11 L30 17" stroke={color} strokeWidth="0.4" opacity="0.6"/>
      {/* Headlight */}
      <circle cx="58" cy="18" r="1.1" fill="#FFF8DC"/>
      {/* Door handle */}
      <rect x="25" y="19" width="4" height="0.8" rx="0.4" fill={accent} opacity="0.5"/>
      {/* Wheels */}
      <circle cx="16" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
      <circle cx="16" cy="26" r="2" fill="#2A2A2A"/>
      <circle cx="48" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
      <circle cx="48" cy="26" r="2" fill="#2A2A2A"/>
    </svg>
  );
}
