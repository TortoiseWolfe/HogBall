import React from 'react';
import Image from 'next/image';

export interface HogBallLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const HogBallLogo: React.FC<HogBallLogoProps> = ({
  className = 'w-full h-full',
  width = 400,
  height = 400,
}) => {
  return (
    <Image
      src="/hogball-logo.svg"
      alt="HogBall Logo"
      width={width}
      height={height}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      priority
    />
  );
};

HogBallLogo.displayName = 'HogBallLogo';
