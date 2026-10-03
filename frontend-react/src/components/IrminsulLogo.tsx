import React from 'react';

interface IrminsulLogoProps {
  className?: string;
  size?: number | string;
}

export const IrminsulLogo: React.FC<IrminsulLogoProps> = ({ className = 'w-6 h-6', size }) => (
  <img
    src="/logo.svg"
    alt="Irminsul IDE Logo"
    className={`inline-block flex-shrink-0 object-contain select-none ${className}`}
    style={size ? { width: size, height: size } : undefined}
    draggable={false}
  />
);
