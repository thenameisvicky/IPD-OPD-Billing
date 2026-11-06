import { RefObject, useEffect } from "react";

export function useOutsideDismiss(
  refs: RefObject<HTMLElement | null>[],
  isOpen: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onDismiss();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, onDismiss, refs]);
}
