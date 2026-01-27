import { useState } from "react";

export function useColumnSelection(total: number) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === total
        ? new Set()
        : new Set([...Array(total).keys()])
    );
  };

  const clear = () => setSelected(new Set());

  return { selected, toggle, toggleAll, clear };
}
