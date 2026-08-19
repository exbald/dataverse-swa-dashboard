import { useEffect, useRef } from "react";
import type { RecordItem } from "../lib/types";

type Props = {
  record: RecordItem | null;
  onClose: () => void;
};

export function DetailDrawer({ record, onClose }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (record) {
      closeBtnRef.current?.focus();
    }
  }, [record]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (record) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }
  }, [record, onClose]);

  if (!record) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Details for ${record.name}`}>
        <div className="drawer__header">
          <h2 className="drawer__title">{record.name}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            aria-label="Close details"
          >
            ✕
          </button>
        </div>
        <div className="drawer__body">
          <div className="drawer__field">
            <span className="drawer__label">ID</span>
            <span className="drawer__value" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {record.id}
            </span>
          </div>
          <div className="drawer__field">
            <span className="drawer__label">Status</span>
            <span className="drawer__value">{record.status}</span>
          </div>
          <div className="drawer__field">
            <span className="drawer__label">Owner</span>
            <span className="drawer__value">{record.owner}</span>
          </div>
          <div className="drawer__field">
            <span className="drawer__label">Created</span>
            <span className="drawer__value">{new Date(record.createdOn).toLocaleString()}</span>
          </div>
          {typeof record.amount === "number" && (
            <div className="drawer__field">
              <span className="drawer__label">Amount</span>
              <span className="drawer__value">${record.amount.toLocaleString()}</span>
            </div>
          )}
          {/* Render passthrough fields */}
          {Object.entries(record)
            .filter(([k]) => !["id", "name", "status", "owner", "createdOn", "amount"].includes(k))
            .map(([k, v]) => (
              <div key={k} className="drawer__field">
                <span className="drawer__label">{k}</span>
                <span className="drawer__value">{String(v ?? "—")}</span>
              </div>
            ))}
        </div>
      </aside>
    </>
  );
}
