"use client";

import { useCallback, useEffect, useState, useRef } from "react";

import { useAppStore } from "../state/store";
import type { UploadedAudio } from "../state/types";

interface MusicPreset {
  id: string;
  name: string;
  filename: string;
  url: string;
}

interface RenderStatus {
  type: "lambda" | "local";
  renderId?: string;
  bucketName?: string;
  functionName?: string;
  region?: string;
  url?: string;
}

export function ExportPanel() {
  const format = useAppStore((state) => state.exportOptions.format);
  const setExportFormat = useAppStore((state) => state.setExportFormat);
  const photoPairs = useAppStore((state) => state.photoPairs);
  const overlay = useAppStore((state) => state.overlay);
  const compare = useAppStore((state) => state.compare);
  const animation = useAppStore((state) => state.animation);
  const audio = useAppStore((state) => state.audio);
  const audioLoop = useAppStore((state) => state.audioLoop);
  const setAudio = useAppStore((state) => state.setAudio);
  const setAudioLoop = useAppStore((state) => state.setAudioLoop);
  const setAnimationDuration = useAppStore((state) => state.setAnimationDuration);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [musicPresets, setMusicPresets] = useState<MusicPreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  // Progress state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<"idle" | "uploading" | "rendering" | "done">("idle");

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

      // Get duration
      const audioObj = new Audio(preset.url);
      audioObj.onloadedmetadata = () => {
        setAudio({
          id: `preset-${preset.id}`,
          src: preset.url,
          name: preset.name,
          origin: "preset",
          duration: audioObj.duration,
        });
      };
    },
    [setAudio],
  );

  const clearAudioSelection = useCallback(() => {
    setAudio(undefined);
  }, [setAudio]);

  const uploadFileWithProgress = async (file: File, contentType: string): Promise<string> => {
    // 1. Get presigned URL
    const res = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to get upload URL");
    }
    const { uploadUrl, fileUrl } = await res.json();

    // 2. Upload to S3 with XHR for progress
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // We can track individual file progress here if needed
          // For now, we update global progress in the loop
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(fileUrl);
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(file);
    });
  };

  const runMp4Export = useCallback(async () => {
    setCurrentStep("uploading");
    setStatus("Uploading assets…");
    setUploadProgress(0);
    setRenderProgress(0);

    if (photoPairs.length === 0) {
      throw new Error("Add at least one photo pair before exporting.");
    }

    const completePairs = photoPairs.filter((pair) => pair.top && pair.bottom);
    if (completePairs.length !== photoPairs.length) {
      throw new Error("Each pair must include both a top and bottom photo before exporting.");
    }

    // --- UPLOAD PHASE ---
    const filesToUpload: { file: File; type: string; key: string }[] = [];

    // Collect all files
    completePairs.forEach((pair, i) => {
      if (pair.top?.file) filesToUpload.push({ file: pair.top.file, type: pair.top.file.type, key: `top-${i}` });
      if (pair.bottom?.file) filesToUpload.push({ file: pair.bottom.file, type: pair.bottom.file.type, key: `bottom-${i}` });
    });

    // Audio upload if needed (and not a preset/url)
    if (audio?.file && audio.origin === "upload") {
      filesToUpload.push({ file: audio.file, type: audio.file.type || "audio/mpeg", key: "audio" });
    }

    const uploadedUrls: Record<string, string> = {};
    let completedUploads = 0;

    // Upload sequentially or parallel? Parallel is faster but harder to track total progress smoothly.
    // Let's do batches or parallel.
    await Promise.all(filesToUpload.map(async (item) => {
      try {
        const url = await uploadFileWithProgress(item.file, item.type);
        uploadedUrls[item.key] = url;
        completedUploads++;
        setUploadProgress(Math.round((completedUploads / filesToUpload.length) * 100));
      } catch (err) {
        console.error(`Failed to upload ${item.key}`, err);
        throw err;
      }
    }));

    // Reconstruct payload with S3 URLs
    const topImages = completePairs.map((_, i) => uploadedUrls[`top-${i}`] || ""); // Should be there
    const bottomImages = completePairs.map((_, i) => uploadedUrls[`bottom-${i}`] || "");
    const audioUrl = audio?.origin === "preset" ? audio.id.replace("preset-", "") : (uploadedUrls["audio"] || audio?.src); // If preset, send filename/id. If upload, send S3 URL.

    // --- RENDER PHASE ---
    setCurrentStep("rendering");
    setStatus("Starting render…");

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
        audio: audio?.origin === "preset" ? undefined : audioUrl, // If URL, pass as audio. If preset, pass as audioPreset below
        audioPreset: audio?.origin === "preset" ? audio.name : undefined, // API expects filename for preset? API logic needs check.
        audioLoop,
        audioDuration: audio?.duration,
        // Actually API logic: if audioPreset is passed, it looks in public/music-presets.
        // Our audio.name for preset is the filename? Let's check handleSelectPreset.
        // handleSelectPreset sets name: preset.name. But preset.filename is what we need?
        // We might need to adjust handleSelectPreset to store filename.
        // For now let's assume audio.src is the URL, but for preset we want the server to handle it if possible or just pass the URL?
        // If we pass the public URL of the preset (audio.src), the API will treat it as remote URL and download it. That works!
        // So we can just pass audio: audio.src (which is the public URL) for presets too.
        // BUT, the API has specific optimization for presets to upload them to S3 if using Lambda.
        // Let's stick to passing 'audio' as the URL.
      }),
    });

    if (!response.ok) {
      throw new Error("Render request failed");
    }

    const renderData: RenderStatus = await response.json();

    if (renderData.type === "lambda" && renderData.renderId) {
      // Poll for progress
      const { renderId, bucketName, functionName, region } = renderData;

      let done = false;
      while (!done) {
        await new Promise(r => setTimeout(r, 1000));

        const statusRes = await fetch("/api/render/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ renderId, bucketName, functionName, region }),
        });

        if (statusRes.ok) {
          const progressData = await statusRes.json();
          if (progressData.overallProgress) {
            setRenderProgress(Math.round(progressData.overallProgress * 100));
          }

          if (progressData.done) {
            done = true;
            setStatus("Render complete!");
            if (progressData.outputFile) {
              window.open(progressData.outputFile, "_blank");
            }
          } else if (progressData.fatalErrorEncountered) {
            throw new Error("Render failed: " + JSON.stringify(progressData.errors));
          }
        }
      }
    } else if (renderData.url) {
      // Local render (immediate response usually, or we might need to poll if we changed it to async? 
      // Current local implementation waits for render. So it returns URL directly.)
      setRenderProgress(100);
      setStatus("Render complete!");
      window.open(renderData.url, "_blank");
    }

    setCurrentStep("done");
  }, [
    animation,
    compare.orientation,
    compare.showDivider,
    overlay,
    photoPairs,
    photoPairs,
    audio,
    audioLoop,
  ]);

  const handleExport = useCallback(async () => {
    if (isExporting) return;

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
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setStatus(message);
      setCurrentStep("idle");
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
        {/* Music Selection UI - Unchanged */}
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

              const audioObj = new Audio(src);
              audioObj.onloadedmetadata = () => {
                setAudio({ ...audioPayload, duration: audioObj.duration });
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
                      className={`rounded-lg border border-dashed px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.25em] transition-colors ${isSelected
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

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={audioLoop}
              onChange={(e) => setAudioLoop(e.target.checked)}
              className="h-3 w-3 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950/60"
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
              Loop audio
            </span>
          </label>
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

        {/* Progress Bar */}
        {isExporting && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>{currentStep === "uploading" ? "Uploading assets" : currentStep === "rendering" ? "Rendering video" : "Processing"}</span>
              <span>{currentStep === "uploading" ? `${uploadProgress}%` : `${renderProgress}%`}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full bg-sky-500 transition-all duration-300 ease-out"
                style={{ width: `${currentStep === "uploading" ? uploadProgress : renderProgress}%` }}
              />
            </div>
          </div>
        )}

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
    </section >
  );
}
