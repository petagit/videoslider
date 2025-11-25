/* eslint-disable @next/next/no-img-element */
"use client";

import { ChangeEvent, DragEvent, MouseEvent, useCallback, useMemo, useState } from "react";
import { useAppStore } from "../state/store";
import type { UploadedImage } from "../state/types";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const MAX_PAIRS = 4;
const PREVIEW_SIZE_CLASS = "h-32"; // consistent drop zone height to avoid scrolling

type SlotKind = "top" | "bottom";

interface DragTarget {
  pairIndex: number;
  slot: SlotKind;
}

const loadImageDimensions = async (src: string) =>
  new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });

const buildUploadedImage = async (file: File): Promise<UploadedImage> => {
  const src = URL.createObjectURL(file);
  const { width, height } = await loadImageDimensions(src);
  return {
    id: crypto.randomUUID(),
    file,
    src,
    alt: file.name || "Uploaded image",
    naturalWidth: width,
    naturalHeight: height,
  };
};

const imagePreview = (image?: UploadedImage) => {
  if (!image) {
    return (
      <div
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300/80 bg-slate-100 text-xs font-medium text-slate-500 transition-colors dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-400 ${PREVIEW_SIZE_CLASS}`}
      >
        <span>Drop image</span>
        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">or browse</span>
      </div>
    );
  }

  return <img src={image.src} alt={image.alt} className={`${PREVIEW_SIZE_CLASS} w-full rounded-lg object-cover`} />;
};

export function MediaPanel() {
  const photoPairs = useAppStore((state) => state.photoPairs);
  const activePairIndex = useAppStore((state) => state.activePairIndex);
  const compare = useAppStore((state) => state.compare);
  const setPhotoAt = useAppStore((state) => state.setPhotoAt);
  const addPhotoPair = useAppStore((state) => state.addPhotoPair);
  const removePhotoPair = useAppStore((state) => state.removePhotoPair);
  const setActivePairIndex = useAppStore((state) => state.setActivePairIndex);
  const clearImages = useAppStore((state) => state.clearImages);
  const setOrientation = useAppStore((state) => state.setOrientation);
  const toggleDivider = useAppStore((state) => state.toggleDivider);

  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const displayPairs = useMemo(() => photoPairs.slice(0, MAX_PAIRS), [photoPairs]);
  const canAddPair = photoPairs.length < MAX_PAIRS;
  const readyPairCount = useMemo(
    () => photoPairs.filter((pair) => pair.top && pair.bottom).length,
    [photoPairs],
  );
  const activePairNumber = photoPairs.length > 0 ? Math.min(activePairIndex, photoPairs.length - 1) + 1 : 1;

  const assignImage = useCallback(
    async (pairIndex: number, slot: SlotKind, file?: File) => {
      if (!file || !ACCEPTED_TYPES.includes(file.type)) {
        return;
      }
      const uploaded = await buildUploadedImage(file);
      setPhotoAt(pairIndex, slot, uploaded);
    },
    [setPhotoAt],
  );

  const handleFileInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>, pairIndex: number, slot: SlotKind) => {
      const [file] = Array.from(event.target.files ?? []);
      await assignImage(pairIndex, slot, file);
      event.target.value = "";
    },
    [assignImage],
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLLabelElement>, pairIndex: number, slot: SlotKind) => {
      event.preventDefault();
      setDragTarget(null);
      const [file] = Array.from(event.dataTransfer.files ?? []);
      await assignImage(pairIndex, slot, file);
    },
    [assignImage],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLLabelElement>, pairIndex: number, slot: SlotKind) => {
    event.preventDefault();
    setDragTarget({ pairIndex, slot });
  }, []);

  const handleDragLeave = useCallback(() => setDragTarget(null), []);

  const handleRemoveImage = useCallback(
    (event: MouseEvent<HTMLButtonElement>, pairIndex: number, slot: SlotKind) => {
      event.preventDefault();
      event.stopPropagation();
      setPhotoAt(pairIndex, slot, undefined);
    },
    [setPhotoAt],
  );

  const hasIncompletePair = useMemo(
    () => photoPairs.some((pair) => !pair.top || !pair.bottom),
    [photoPairs],
  );

const mediaModal = !isModalOpen
    ? null
    : (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm transition-colors dark:bg-slate-950/80"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-5 sm:px-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1 pr-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-900 dark:text-slate-200">Media uploader</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Drag and drop images into each slot or browse from your computer. You can add up to four photo pairs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {displayPairs.map((pair, index) => {
                    const topImage = pair.top;
                    const bottomImage = pair.bottom;
                    const isActive = activePairIndex === index;
                    return (
                      <div
                        key={pair.id}
                        className={`flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3 transition-colors dark:border-slate-800 dark:bg-slate-950/50 ${
                          isActive ? "border-sky-400 shadow-inner shadow-sky-500/20" : ""
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                            Photo 1 drag or upload photo
                          </span>
                          <label
                            onDrop={(event) => void handleDrop(event, index, "top")}
                            onDragOver={(event) => handleDragOver(event, index, "top")}
                            onDragLeave={handleDragLeave}
                            className={`group relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white text-center transition-colors dark:border-slate-700 dark:bg-slate-950/70 ${
                              dragTarget?.pairIndex === index && dragTarget.slot === "top"
                                ? "border-sky-400 text-sky-700 dark:text-sky-200"
                                : "hover:border-slate-400 hover:text-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-200"
                            }`}
                          >
                            <input
                              type="file"
                              accept={ACCEPTED_TYPES.join(",")}
                              className="hidden"
                              onChange={(event) => void handleFileInput(event, index, "top")}
                            />
                            {imagePreview(topImage)}
                            {topImage ? (
                              <button
                                type="button"
                                onClick={(event) => handleRemoveImage(event, index, "top")}
                                className="absolute right-2 top-2 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-700 transition hover:bg-slate-300 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                Remove
                              </button>
                            ) : null}
                          </label>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                            Photo 2 drag or upload photo
                          </span>
                          <label
                            onDrop={(event) => void handleDrop(event, index, "bottom")}
                            onDragOver={(event) => handleDragOver(event, index, "bottom")}
                            onDragLeave={handleDragLeave}
                            className={`group relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white text-center transition-colors dark:border-slate-700 dark:bg-slate-950/70 ${
                              dragTarget?.pairIndex === index && dragTarget.slot === "bottom"
                                ? "border-sky-400 text-sky-700 dark:text-sky-200"
                                : "hover:border-slate-400 hover:text-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-200"
                            }`}
                          >
                            <input
                              type="file"
                              accept={ACCEPTED_TYPES.join(",")}
                              className="hidden"
                              onChange={(event) => void handleFileInput(event, index, "bottom")}
                            />
                            {imagePreview(bottomImage)}
                            {bottomImage ? (
                              <button
                                type="button"
                                onClick={(event) => handleRemoveImage(event, index, "bottom")}
                                className="absolute right-2 top-2 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-700 transition hover:bg-slate-300 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                Remove
                              </button>
                            ) : null}
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setActivePairIndex(index)}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] transition ${
                              isActive
                                ? "bg-sky-500/30 text-sky-100"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            Preview pair
                          </button>
                          {photoPairs.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removePhotoPair(index)}
                              className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200"
                            >
                              Remove pair
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>


                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {displayPairs.map((pair, index) => (
                      <div
                        key={`${pair.id}-chip`}
                        className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] ${
                          activePairIndex === index
                            ? "border-sky-400 bg-sky-500/20 text-sky-700 dark:text-sky-100"
                            : "border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActivePairIndex(index)}
                          className="transition hover:text-slate-900 dark:hover:text-white"
                        >
                          Pair {index + 1}
                        </button>
                        {photoPairs.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removePhotoPair(index)}
                            className="text-slate-500 transition hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-300"
                            aria-label={`Remove pair ${index + 1}`}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addPhotoPair}
                      disabled={!canAddPair}
                      className="rounded-full border border-slate-300 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                    >
                      {canAddPair ? "Add photo pair" : "Max pairs reached"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="rounded-full bg-sky-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-700 transition hover:bg-sky-500/25 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:bg-sky-500/30"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/60">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800 dark:text-slate-300">Media</h2>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">Upload photo pairs.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Manage uploads
          </button>
          <button
            type="button"
            onClick={clearImages}
            className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
          >
            Clear
          </button>
        </div>
      </header>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors dark:border-slate-800 dark:bg-slate-950/40">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
          <span>{readyPairCount}/{photoPairs.length} ready</span>
          <span className="text-slate-400">•</span>
          <span>Pair {activePairNumber}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {photoPairs.map((pair, index) => {
            const isActive = activePairIndex === index;
            const isComplete = Boolean(pair.top && pair.bottom);
            return (
              <div
                key={pair.id}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] ${
                  isActive
                    ? "border-sky-400 bg-sky-500/20 text-sky-700 dark:text-sky-100"
                    : "border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActivePairIndex(index)}
                  className={`flex items-center gap-2 transition ${isActive ? "" : "hover:text-slate-900 dark:hover:text-white"}`}
                >
                  Pair {index + 1}
                  <span
                    className={`h-2 w-2 rounded-full ${isComplete ? "bg-emerald-400" : "bg-amber-400"}`}
                    aria-hidden="true"
                  />
                </button>
                {photoPairs.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removePhotoPair(index)}
                    className="text-slate-500 transition hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-300"
                    aria-label={`Remove pair ${index + 1}`}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        {hasIncompletePair ? (
          <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-300">
            Add both top and bottom photos for every pair to enable seamless cuts.
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-slate-600 dark:text-slate-400">Ready pairs will render sequentially in the export.</p>
        )}
      </div>

      {mediaModal}

      <div className="mt-5 flex flex-col gap-3 rounded-xl bg-slate-100 p-4 transition-colors dark:bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Orientation</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {compare.orientation === "vertical" ? "Vertical (left vs right)" : "Horizontal (top vs bottom)"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOrientation(compare.orientation === "vertical" ? "horizontal" : "vertical")}
            className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-700 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Flip
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Divider</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">Show reference line over the slider.</p>
          </div>
          <button
            type="button"
            onClick={toggleDivider}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] transition ${
              compare.showDivider
                ? "bg-sky-500/20 text-sky-700 hover:bg-sky-500/30 dark:text-sky-200"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {compare.showDivider ? "On" : "Off"}
          </button>
        </div>
      </div>
    </section>
  );
}
