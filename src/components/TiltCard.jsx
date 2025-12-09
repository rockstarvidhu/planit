import React, { useRef, useState } from 'react';

const TiltCard = ({ children, className, onClick, disabled }) => {
  const cardRef = useRef(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [glow, setGlow] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e) => {
    if (disabled || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -5; // Reduced angle for stability
    const rotateY = ((x - centerX) / centerX) * 5;

    setRotation({ x: rotateX, y: rotateY });
    setGlow({ x: (x / rect.width) * 100, y: (y / rect.height) * 100, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
    setGlow({ ...glow, opacity: 0 });
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative transition-all duration-300 ease-out preserve-3d ${className}`}
      style={{
        transform: disabled 
            ? 'none' // Flatten if expanded
            : `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(1, 1, 1)`,
        zIndex: disabled ? 50 : 1 // Bring to front if expanded
      }}
    >
      {!disabled && (
        <div 
            className="absolute inset-0 pointer-events-none rounded-3xl mix-blend-overlay transition-opacity duration-500"
            style={{
            background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, rgba(255,255,255,0.3), transparent 60%)`,
            opacity: glow.opacity
            }}
        />
      )}
      {children}
    </div>
  );
};

export default TiltCard;