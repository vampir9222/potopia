"use client";
import { Modal } from "@app/ui";
import { useRef, useState, type ReactNode } from "react";

/** Conserve la commande/version proposée à l’ouverture, même si le polling avance entre-temps. */
export function ConfirmAction({
  title,
  message,
  children,
  onConfirm,
  disabled = false,
  className = "goty-button",
}: {
  title: string;
  message: string;
  children: ReactNode;
  onConfirm: () => Promise<boolean>;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const command = useRef(onConfirm);
  async function confirm() {
    if (disabled || running.current) return;
    running.current = true;
    setPending(true);
    try {
      await command.current();
    } finally {
      running.current = false;
      setPending(false);
      setOpen(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled || pending}
        onClick={() => {
          command.current = onConfirm;
          setOpen(true);
        }}
      >
        {children}
      </button>
      <Modal
        open={open}
        title={title}
        onClose={() => {
          if (!running.current) setOpen(false);
        }}
      >
        <div className="goty goty-form">
          <p>{message}</p>
          <div className="goty-row">
            <button
              type="button"
              className="goty-button secondary"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="goty-button"
              disabled={disabled || pending}
              onClick={() => void confirm()}
            >
              {pending ? "Enregistrement…" : "Confirmer"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
