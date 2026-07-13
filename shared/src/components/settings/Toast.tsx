/**
 * Minimal bottom-right toast system for the settings window.
 *
 * A single provider holds the queue; `useToast()` returns a `toast(message)`
 * function callers fire on success actions (preset created/applied/updated).
 * Toasts auto-dismiss after a few seconds and stack upward from the corner.
 * Palette-driven so it reads correctly in both dark and light settings themes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
import { useSettingsUI } from "./primitives";

type ToastItem = { id: number; message: string };

const ToastContext = createContext<(message: string) => void>(() => {});

/** Fire a transient confirmation toast. No-op outside a ToastProvider. */
export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 2600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts }: { toasts: ToastItem[] }) {
  const { palette } = useSettingsUI();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 rounded-[12px] px-4 py-2.5 text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            backgroundColor: palette.card,
            color: palette.text,
            border: `1px solid ${palette.divider}`,
          }}
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: palette.selected }}
          >
            <Check className="h-3 w-3" />
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
