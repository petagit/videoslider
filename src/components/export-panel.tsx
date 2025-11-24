"use client";

import { useCallback, useEffect, useState } from "react";

import { useAppStore } from "../state/store";
import type { UploadedAudio } from "../state/types";

interface MusicPreset {
  id: string;
  name: string;
  filename: string;
  url: string;
}

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
  const [musicPresets, setMusicPresets] = useState<MusicPreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  const durationSeconds = Math.round(animation.durationMs / 1000);

  const totalPairs = photoPairs.length;
  const completePairCount = photoPairs.filter((pair) => pair.top && pair.bottom).length;
  const exportBlocked = totalPairs === 0 || completePairCount !== totalPairs;

  const fetchMusicPresets = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingPresets(true);
    try {
      const response = await fetch("/api/music-presets", { signal });
      if (!response?.ok) {
        throw new Error("Failed to load music presets.");
      }
      const payload = (await response.json()) as { presets?: MusicPreset[] };
      if (signal?.aborted) {
        return;
      }
      setMusicPresets(payload.presets ?? []);
      setPresetError(null);
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        return;
      }
      console.error("Failed to load music presets", error);
      setMusicPresets([]);
      setPresetError("Unable to load music presets. Add files to public/music-presets.");
    } finally {
      if (!signal?.aborted) {
        setIsLoadingPresets(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchMusicPresets(controller.signal);
    return () => controller.abort();
  }, [fetchMusicPresets]);

  const handleSelectPreset = useCallback(
    (preset: MusicPreset) => {
      setAudio({
        id: `preset-${preset.id}`,
        src: preset.url,
        name: preset.name,
        origin: "preset",
      });
    },
    [setAudio],
  );

  const clearAudioSelection = useCallback(() => {
    setAudio(undefined);
  }, [setAudio]);

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
      let message = "Render failed";
      try {
        const text = await response.text();
        if (text) {
          try {
            const parsed = JSON.parse(text) as { message?: string } | undefined;
            message = parsed?.message || text || message;
          } catch {
            message = text || message;
          }
        }
      } catch {
        // Ignore and fall back to default message
      }
      throw new Error(message);
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
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/60">
      <header className="mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800 dark:text-slate-300">
          Export
        </h2>
        <p className="text-[11px] text-slate-600 dark:text-slate-400">
          Render MP4 video.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
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
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
          />
          {audio && audio.origin === "upload" ? (
            <span className="text-xs text-slate-600 dark:text-slate-400">{audio.name}</span>
          ) : null}

          <div className="mt-2 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              Music library
            </span>
            {isLoadingPresets ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-100 p-3 text-center text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                Loading presets…
              </div>
            ) : musicPresets.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {musicPresets.map((preset) => {
                  const isSelected = audio?.origin === "preset" && audio?.id === `preset-${preset.id}`;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`rounded-lg border border-dashed px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.25em] transition-colors ${
                        isSelected
                          ? "border-sky-400 bg-sky-500/20 text-sky-700 dark:text-sky-100"
                          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
                      }`}
                    >
                      <span className="line-clamp-2">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-100 p-3 text-center text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                Drop audio files into <code className="font-mono text-slate-500 dark:text-slate-300">public/music-presets</code> to add presets.
              </div>
            )}
            {presetError ? (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">{presetError}</p>
            ) : null}
          </div>

          {audio ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-600 transition-colors dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
              <span className="truncate">
                {audio.origin === "preset" ? `Preset: ${audio.name}` : `Uploaded: ${audio.name}`}
              </span>
              <button
                type="button"
                onClick={clearAudioSelection}
                className="shrink-0 rounded-full border border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
              >
                Remove
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">No music selected.</p>
          )}
        </div>
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
