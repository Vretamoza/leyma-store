import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface Slide {
  id: string;
  /** Sin `src` se muestra un recuadro neutro (el producto aún no tiene fotos). */
  src?: string;
  alt: string;
}

interface Props {
  slides: Slide[];
  label: string;
  badges?: ReactNode;
  /** Cambia con el tono para reiniciar el carrusel y animar el cambio de foto. */
  resetKey: string;
}

export function Gallery({ slides, label, badges, resetKey }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    setIndex(0);
    strip.current?.scrollTo({ left: 0 });
  }, [resetKey]);

  useEffect(() => {
    const dlg = dialog.current;
    if (!dlg) return;
    if (zoom !== null && !dlg.open) dlg.showModal();
    if (zoom === null && dlg.open) dlg.close();
  }, [zoom]);

  function onScroll() {
    const el = strip.current;
    if (!el || !el.clientWidth) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(i: number) {
    const el = strip.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    setIndex(i);
  }

  const photos = slides.filter((s) => s.src);
  const many = slides.length > 1;

  return (
    <section aria-label={label} className="flex flex-col gap-2.5 md:flex-row-reverse md:gap-4">
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-ph">
        <div
          key={resetKey}
          ref={strip}
          onScroll={onScroll}
          className="gallery-fade flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((s, i) => (
            <div key={s.id} className="aspect-[4/5] w-full shrink-0 snap-center">
              {s.src ? (
                <button
                  type="button"
                  onClick={() => setZoom(i)}
                  aria-label={`Ampliar foto ${i + 1}`}
                  className="block h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
                >
                  <img
                    src={s.src}
                    alt={s.alt}
                    width={800}
                    height={1000}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-ph text-sm text-muted">Foto próximamente</div>
              )}
            </div>
          ))}
        </div>
        {badges}
        {many && (
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs text-ink">
            {index + 1} / {slides.length}
          </span>
        )}
      </div>

      {many && (
        <div role="tablist" aria-label="Miniaturas" className="flex gap-2 overflow-x-auto md:w-16 md:flex-col md:overflow-visible">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Foto ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-20 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-ph p-0 ${i === index ? 'border-2 border-primary' : 'border border-line'}`}
            >
              {s.src && <img src={s.src} alt="" width={64} height={80} loading="lazy" className="h-full w-full object-cover" />}
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={dialog}
        onClose={() => setZoom(null)}
        onClick={(e) => e.target === dialog.current && setZoom(null)}
        aria-label="Foto ampliada"
        className="m-auto max-h-[96dvh] max-w-[96vw] border-0 bg-transparent p-0 backdrop:bg-ink/80"
      >
        {zoom !== null && photos.length > 0 && slides[zoom]?.src && (
          <div className="relative">
            <img src={slides[zoom].src} alt={slides[zoom].alt} className="max-h-[96dvh] max-w-[96vw] rounded-xl object-contain" />
            <button
              type="button"
              onClick={() => setZoom(null)}
              aria-label="Cerrar"
              className="absolute right-2 top-2 flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-surface/90 text-ink"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}
      </dialog>
    </section>
  );
}
