"use client";

import { useCallback, useState } from "react";

import { useAppStore } from "../state/store";
import type { UploadedAudio } from "../state/types";

export function ExportPanel() {
  const format = useAppStore((state) => state.exportOptions.format);
  const setExportFormat = useAppStore((state) => state.setExportFormat);
  const photoPairs = useAppStore((state) => state.photoPairs);
  const overlay = useAppStore((state) => state.overlay);
  const compare = useAppStore((state) => state.compare);
  const animation = useAppStore((state) => state.animation);
  const audio = useAppStore((state) => state.audio);
  const setAudio = useAppStore((state) => state.setAudio);
  const setAnimationDuration = useAppStore((state) => state.setAnimationDuration);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const durationSeconds = Math.round(animation.durationMs / 1000);

  const totalPairs = photoPairs.length;
  const completePairCount = photoPairs.filter((pair) => pair.top && pair.bottom).length;
  const exportBlocked = totalPairs === 0 || completePairCount !== totalPairs;

  const getDataUrl = useCallback(async (file?: File, fallback?: string) => {
    if (file) {
      const reader = new FileReader();
      const result = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      return result;
    }

    if (fallback) {
      return fallback;
    }

    return "";
  }, []);

  const runMp4Export = useCallback(async () => {
    setStatus("Preparing assets…");

    if (photoPairs.length === 0) {
      throw new Error("Add at least one photo pair before exporting.");
    }

    const completePairs = photoPairs.filter((pair) => pair.top && pair.bottom);
    if (completePairs.length !== photoPairs.length) {
      throw new Error("Each pair must include both a top and bottom photo before exporting.");
    }

    const [topImages, bottomImages, audioDataUrl] = await Promise.all([
      Promise.all(completePairs.map((pair) => getDataUrl(pair.top!.file, pair.top!.src))),
      Promise.all(completePairs.map((pair) => getDataUrl(pair.bottom!.file, pair.bottom!.src))),
      getDataUrl(audio?.file, audio?.src),
    ]);

    setStatus("Rendering video via Remotion…");

    const response = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topImages,
        bottomImages,
        compare: {
          orientation: compare.orientation,
          showDivider: compare.showDivider,
        },
        overlay: {
          markdown: overlay.markdown,
          fontFamily: overlay.fontFamily,
          fontSizePx: overlay.fontSizePx,
          color: overlay.color,
          background: overlay.background ?? null,
          maxWidthPct: overlay.maxWidthPct,
          align: overlay.align,
          borderColor: overlay.borderColor,
          borderWidthPx: overlay.borderWidthPx,
          borderStyle: overlay.borderStyle,
          borderRadiusPx: overlay.borderRadiusPx,
        },
        animation,
        audio: audioDataUrl ?? null,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ message: "Render failed" }));
      throw new Error(errorPayload.message ?? "Render failed");
    }

    setStatus("Downloading video…");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "slider-reveal-tiktok.mp4";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus("MP4 exported – check your downloads.");
  }, [
    animation,
    compare.orientation,
    compare.showDivider,
    getDataUrl,
    overlay.align,
    overlay.background,
    overlay.borderColor,
    overlay.borderRadiusPx,
    overlay.borderStyle,
    overlay.borderWidthPx,
    overlay.color,
    overlay.fontFamily,
    overlay.fontSizePx,
    overlay.markdown,
    overlay.maxWidthPct,
    photoPairs,
    audio?.file,
    audio?.src,
  ]);

  const handleExport = useCallback(async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    setStatus(null);

    try {
      if (format !== "mp4") {
        setStatus("Still-image export is coming soon. Switch to MP4 for now.");
        return;
      }

      if (exportBlocked) {
        setStatus("Add matching top and bottom photos for every pair before exporting.");
        return;
      }

      await runMp4Export();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while exporting the video.";

      setStatus(message);
    } finally {
      setIsExporting(false);
    }
  }, [exportBlocked, format, isExporting, runMp4Export]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60 transition-colors dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-slate-950/40">
      <header className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-800 dark:text-slate-300">
          Export
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Render an MP4 via Remotion using the current slider, overlay, and animation settings.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
            Background music (optional)
          </span>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) {
                setAudio(undefined);
                return;
              }
              const src = URL.createObjectURL(file);
              const audioPayload: UploadedAudio = {
                id: `${Date.now()}`,
                file,
                src,
                name: file.name,
                origin: "upload",
              };
              setAudio(audioPayload);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
          />
          {audio ? (
            <span className="text-xs text-slate-600 dark:text-slate-400">{audio.name}</span>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">MP3/WAV/M4A</span>
          )}
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
            Format
          </span>
          <select
            value={format}
            onChange={(event) => setExportFormat(event.target.value as typeof format)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
          >
            <option value="mp4">MP4 (sequential cuts)</option>
            <option value="png">PNG (coming soon)</option>
            <option value="jpeg">JPEG (coming soon)</option>
            <option value="webp">WebP (coming soon)</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
            Video length
          </span>
          <input
            type="range"
            min={3}
            max={60}
            step={1}
            value={durationSeconds}
            onChange={(event) => setAnimationDuration(Number(event.target.value) * 1000)}
            className="accent-sky-500"
          />
          <span className="text-xs text-slate-600 dark:text-slate-300">{durationSeconds} second{durationSeconds === 1 ? "" : "s"}</span>
        </label>

        <button
          type="button"
          onClick={() => void handleExport()}
          className="inline-flex items-center justify-center rounded-full bg-sky-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-700 shadow-inner shadow-sky-500/20 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20"
          disabled={isExporting || exportBlocked}
        >
          {isExporting ? "Exporting…" : "Export preview"}
        </button>

        {exportBlocked ? (
          <p className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-600 dark:text-amber-200">
            Add matching top and bottom photos for every pair to enable exporting.
          </p>
        ) : (
          <p className="text-[11px] text-slate-600 dark:text-slate-400">{completePairCount} photo pair{completePairCount === 1 ? "" : "s"} will render sequentially.</p>
        )}

        {status ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-100 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
