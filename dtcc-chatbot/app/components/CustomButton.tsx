// app/components/CustomButton.tsx
'use client';
import React from 'react';

interface CustomButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export default function CustomButton({ children, ...props }: CustomButtonProps) {
  return (
    <button {...props} data-fdprocessedid="false">
      {children}
    </button>
  );
}