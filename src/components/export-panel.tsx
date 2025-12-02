"use client";

import { useCallback, useEffect, useState } from "react";

import { useAppStore } from "../state/store";
import type { UploadedAudio } from "../state/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { Progress } from "./ui/progress";
import { cn } from "@/lib/utils";
import { Music, Upload, X, Loader2 } from "lucide-react";

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Export
        </CardTitle>
        <CardDescription className="text-xs">
          Render MP4 video.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Music Selection UI */}
        <div className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Background music
          </span>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-muted/50 text-xs text-muted-foreground transition-colors hover:bg-muted">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload audio</span>
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
                  className="hidden"
                />
              </label>
            </div>

            {audio && (
              <div className="flex items-center justify-between rounded-md border bg-card p-2 text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Music className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{audio.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={clearAudioSelection}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Presets
              </span>
              {isLoadingPresets ? (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
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
                        className={cn(
                          "flex items-center gap-2 rounded-md border p-2 text-left text-xs transition-all",
                          isSelected
                            ? "border-primary bg-primary/5 text-primary"
                            : "bg-background hover:bg-muted"
                        )}
                      >
                        <Music className="h-3 w-3 shrink-0 opacity-50" />
                        <span className="line-clamp-1">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-3 text-center text-[10px] text-muted-foreground">
                  No presets found in public/music-presets
                </div>
              )}
              {presetError && (
                <p className="text-[10px] text-destructive">{presetError}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="loop-audio"
              checked={audioLoop}
              onCheckedChange={(checked) => setAudioLoop(checked as boolean)}
            />
            <label
              htmlFor="loop-audio"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Loop audio
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Format
          </span>
          <Select
            value={format}
            onValueChange={(val) => setExportFormat(val as typeof format)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mp4">MP4 (sequential cuts)</SelectItem>
              <SelectItem value="png" disabled>PNG (coming soon)</SelectItem>
              <SelectItem value="jpeg" disabled>JPEG (coming soon)</SelectItem>
              <SelectItem value="webp" disabled>WebP (coming soon)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Duration
            </span>
            <span className="text-xs text-muted-foreground">{durationSeconds}s</span>
          </div>
          <Slider
            min={3}
            max={60}
            step={1}
            value={[durationSeconds]}
            onValueChange={([val]) => setAnimationDuration(val * 1000)}
          />
        </div>

        <Button
          className="w-full"
          onClick={() => void handleExport()}
          disabled={isExporting || exportBlocked}
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            "Export Video"
          )}
        </Button>

        {/* Progress Bar */}
        {isExporting && (
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{currentStep === "uploading" ? "Uploading assets" : currentStep === "rendering" ? "Rendering" : "Processing"}</span>
              <span>{currentStep === "uploading" ? `${uploadProgress}%` : `${renderProgress}%`}</span>
            </div>
            <Progress value={currentStep === "uploading" ? uploadProgress : renderProgress} />
          </div>
        )}

        {exportBlocked && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            * Add matching top and bottom photos for every pair to enable exporting.
          </p>
        )}

        {status && !isExporting && (
          <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            {status}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
