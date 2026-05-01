import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface FluxContextType {
  isFluxMode: boolean;
  setFluxMode: (enabled: boolean) => void;
}

const FluxContext = createContext<FluxContextType | undefined>(undefined);

export const FluxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isFluxMode, setIsFluxMode] = useState(false);
  const location = useLocation();

  // Automatically detect FLUX mode based on URL
  useEffect(() => {
    if (location.pathname.startsWith('/flux')) {
      setIsFluxMode(true);
    } else if (!location.pathname.startsWith('/flux')) {
      // Don't auto-disable if we just switched? 
      // Actually, standard behavior: if path is /flux/*, we are in FLUX mode.
      setIsFluxMode(false);
    }
  }, [location.pathname]);

  return (
    <FluxContext.Provider value={{ isFluxMode, setFluxMode: setIsFluxMode }}>
      {children}
    </FluxContext.Provider>
  );
};

export const useFlux = () => {
  const context = useContext(FluxContext);
  if (context === undefined) {
    throw new Error('useFlux must be used within a FluxProvider');
  }
  return context;
};
