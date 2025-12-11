import React from 'react';
import { NavBar } from './NavBar';

interface InformationalLayoutProps {
  children: React.ReactNode;
}

export const InformationalLayout: React.FC<InformationalLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col h-full w-full bg-base-100">
      <NavBar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};
