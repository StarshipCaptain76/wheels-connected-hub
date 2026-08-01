import { useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export type LightboxItem = {
  url: string;
  caption?: string | null;
};

type ImageLightboxProps = {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
};

/**
 * Full-screen image lightbox with prev/next buttons, keyboard arrows,
 * and touch swipe. Used by event photos, public gallery, and member profiles.
 */
export function ImageLightbox({ items, index, onClose, onIndex }: ImageLightboxProps) {
  const item = items[index];
  const hasMany = items.length > 1;
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && hasMany) {
        e.preventDefault();
        onIndex((index - 1 + items.length) % items.length);
      } else if (e.key === "ArrowRight" && hasMany) {
        e.preventDefault();
        onIndex((index + 1) % items.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, hasMany, onClose, onIndex]);

  if (!item?.url) return null;

  function goPrev(e?: React.MouseEvent | React.TouchEvent) {
    e?.stopPropagation();
    if (!hasMany) return;
    onIndex((index - 1 + items.length) % items.length);
  }

  function goNext(e?: React.MouseEvent | React.TouchEvent) {
    e?.stopPropagation();
    if (!hasMany) return;
    onIndex((index + 1) % items.length);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (!hasMany) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!hasMany || touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - (touchStartY.current ?? 0);
    touchStartX.current = null;
    touchStartY.current = null;
    // Prefer horizontal swipes; ignore mostly-vertical scrolls
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) goPrev();
    else goNext();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full border-2 border-paper p-2 text-paper"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {hasMany && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border-2 border-paper/60 bg-ink/50 p-2 text-paper hover:border-paper sm:left-6"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border-2 border-paper/60 bg-ink/50 p-2 text-paper hover:border-paper sm:right-6"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div
        className="flex max-h-[90vh] max-w-5xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={item.url}
          alt={item.caption ?? ""}
          className="max-h-[80vh] w-auto max-w-full select-none rounded border-2 border-paper object-contain"
          draggable={false}
        />
        <div className="mt-3 text-center text-paper">
          {item.caption && <p className="text-sm text-paper/80">{item.caption}</p>}
          {hasMany && (
            <p className="mt-1 text-xs text-paper/50">
              {index + 1} / {items.length}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
