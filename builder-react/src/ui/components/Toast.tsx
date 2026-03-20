import { useEffect } from "react";

export interface ToastMessage {
  id: string;
  tone: "ok" | "warn" | "error";
  text: string;
}

interface ToastProps {
  message: ToastMessage | null;
  onDismiss: () => void;
  timeoutMs?: number;
}

export default function Toast({ message, onDismiss, timeoutMs = 2600 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, timeoutMs]);

  if (!message) return null;

  return (
    <div className={`toast toast-${message.tone}`} role="status" aria-live="polite">
      <span>{message.text}</span>
      <button type="button" onClick={onDismiss}>x</button>
    </div>
  );
}

