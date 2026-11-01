"use client";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import type { ReactNode } from "react";

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return result;
  const removed = result.splice(from, 1);
  result.splice(to, 0, ...(removed as T[]));
  return result;
}
export function Sortable({
  items,
  disabled,
  onMove,
  render,
}: {
  items: { id: string; label: string; locked?: boolean }[];
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  render?: (id: string, index: number) => ReactNode;
}) {
  return (
    <ol className="goty-sortable">
      {items.map((item, index) => (
        <li key={item.id} data-goty-row={index}>
          <button
            type="button"
            className="goty-handle"
            aria-label={`Déplacer ${item.label}. Flèches haut et bas disponibles.`}
            disabled={disabled || item.locked}
            style={{ touchAction: "none" }}
            onKeyDown={(event) => {
              if (["ArrowUp", "ArrowDown"].includes(event.key)) {
                event.preventDefault();
                onMove(index, index + (event.key === "ArrowUp" ? -1 : 1));
              }
            }}
            onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
            onPointerUp={(event) => {
              const row = document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>("[data-goty-row]");
              if (row) onMove(index, Number(row.dataset.gotyRow));
            }}
          >
            <GripVertical size={18} />
          </button>
          <span className="goty-sort-label">
            {render ? render(item.id, index) : item.label}
            {item.locked && <small> · annoncée</small>}
          </span>
          <button
            className="goty-icon-button"
            aria-label={`Monter ${item.label}`}
            disabled={disabled || item.locked || index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ArrowUp size={16} />
          </button>
          <button
            className="goty-icon-button"
            aria-label={`Descendre ${item.label}`}
            disabled={disabled || item.locked || index === items.length - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ArrowDown size={16} />
          </button>
        </li>
      ))}
    </ol>
  );
}
