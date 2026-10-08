import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ToastAction = { label: string; run: () => void };

type ToastFn = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ToastFn>(() => {});

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [message, setMessage] = useState<{ text: string; key: number; action?: ToastAction }>();
  const timer = useRef<number>(undefined);

  const toast = useCallback<ToastFn>((text, action) => {
    window.clearTimeout(timer.current);
    setMessage({ text, key: Date.now(), action });
    timer.current = window.setTimeout(() => setMessage(undefined), action ? 6000 : 2400);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message && (
          <div className="toast" key={message.key}>
            <span>{message.text}</span>
            {message.action && (
              <button
                className="toast-action"
                onClick={() => {
                  message.action?.run();
                  setMessage(undefined);
                }}
              >
                {message.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
};
