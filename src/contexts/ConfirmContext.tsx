import React, { createContext, useContext, useState, useCallback, } from 'react';
import type { ReactNode } from 'react';
import { Modal } from '../components/ui/Modal';
import { AlertTriangle } from 'lucide-react';

type ConfirmFunction = (message: string, options?: { title?: string, confirmText?: string, cancelText?: string }) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction>(() => Promise.resolve(false));

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    message: string;
    title: string;
    confirmText: string;
    cancelText: string;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback<ConfirmFunction>((message, options) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        message,
        title: options?.title || 'Confirm Action',
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        resolve,
      });
    });
  }, []);

  const handleClose = (value: boolean) => {
    if (state) {
      state.resolve(value);
      setState(null);
    }
  };

  React.useEffect(() => {
    globalConfirm = confirm;
  }, [confirm]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state?.open}
        onClose={() => handleClose(false)}
        title={state?.title}
        icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
        footer={[
          { label: state?.cancelText || 'Cancel', onClick: () => handleClose(false), variant: 'ghost' },
          { label: state?.confirmText || 'Confirm', onClick: () => handleClose(true), variant: 'danger' }
        ]}
      >
        <p className="text-gray-600">{state?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

export let globalConfirm: ConfirmFunction = () => Promise.resolve(false);

