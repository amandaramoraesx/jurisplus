"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  savedLabel = "Feito!",
  pendingLabel = "Salvando...",
  className = "btn-primary",
}: {
  children: React.ReactNode;
  savedLabel?: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setJustSaved(true);
      const timeout = setTimeout(() => setJustSaved(false), 2200);
      return () => clearTimeout(timeout);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : justSaved ? `✓ ${savedLabel}` : children}
    </button>
  );
}
