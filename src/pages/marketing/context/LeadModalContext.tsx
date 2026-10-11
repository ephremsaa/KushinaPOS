import React, { createContext, useContext, useState, type ReactNode } from 'react';

export interface LeadModalOptions {
  interest?: string;
  sourcePage?: string;
  defaultName?: string;
  defaultBusiness?: string;
}

interface LeadModalContextType {
  isOpen: boolean;
  options: LeadModalOptions;
  openLeadModal: (options?: LeadModalOptions) => void;
  closeLeadModal: () => void;
}

const LeadModalContext = createContext<LeadModalContextType | undefined>(undefined);

export function LeadModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<LeadModalOptions>({});

  const openLeadModal = (newOptions?: LeadModalOptions) => {
    setOptions(newOptions || {});
    setIsOpen(true);
  };

  const closeLeadModal = () => {
    setIsOpen(false);
  };

  return (
    <LeadModalContext.Provider value={{ isOpen, options, openLeadModal, closeLeadModal }}>
      {children}
    </LeadModalContext.Provider>
  );
}

export function useLeadModal() {
  const context = useContext(LeadModalContext);
  if (!context) {
    throw new Error('useLeadModal must be used within a LeadModalProvider');
  }
  return context;
}
