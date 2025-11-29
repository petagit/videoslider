"use client";

import React, { useState, useCallback, useEffect, useRef, DragEvent as ReactDragEvent } from "react";
import { Player } from "@remotion/player";
import { SlideshowComposition } from "../../../remotion/SlideshowComposition";
import { toast } from "sonner";

interface MusicPreset {
    id: string;
    name: string;
    filename: string;
    url: string;
}

interface SlideImage {
    src: string; // Blob URL for preview
    color: string;
    file: File; // Original file for upload
}

const getAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
        const audio = new Audio(url);
        audio.onloadedmetadata = () => {
            console.log("[SlideshowPage] Loaded duration:", audio.duration, "for", url);
            resolve(audio.duration);
        };
        audio.onerror = (e) => {
            console.error("[SlideshowPage] Failed to load audio duration for", url, e);
            resolve(0);
        };
    });
};

const extractColor = async (imageUrl: string): Promise<string> => {
    try {
        const img = new Image();
        // Blob URLs don't need crossOrigin, but if it's remote it might.
        // Local files are blob: here.
        // img.crossOrigin = "Anonymous"; 
        img.src = imageUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return "black";
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `rgb(${r}, ${g}, ${b})`;
    } catch (e) {
        console.warn("Failed to extract color", e);
        return "black";
    }
};

export default function SlideshowPage() {
    const [images, setImages] = useState<SlideImage[]>([]);
    const [durationPerSlide, setDurationPerSlide] = useState(1.5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [musicPresets, setMusicPresets] = useState<MusicPreset[]>([]);
    const [selectedMusic, setSelectedMusic] = useState<string | null>(null);
    const [uploadedMusic, setUploadedMusic] = useState<string | null>(null);
    const [uploadedMusicFile, setUploadedMusicFile] = useState<File | null>(null);
    const [audioLoop, setAudioLoop] = useState(true);
    const [audioDuration, setAudioDuration] = useState<number | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [isCdnUploading, setIsCdnUploading] = useState(false);
    const [cdnUrl, setCdnUrl] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [renderStatus, setRenderStatus] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    useEffect(() => {
        fetch("/api/music-presets")
            .then((res) => res.json())
            .then((data) => setMusicPresets(data.presets))
            .catch((err) => console.error("Failed to load music presets", err));
    }, []);

    const handleFiles = useCallback(async (files: File[]) => {
        const newImages = await Promise.all(files.map(async (file) => {
            const src = URL.createObjectURL(file);
            const color = await extractColor(src);
            return { src, color, file };
        }));
        setImages((prev) => [...prev, ...newImages]);
    }, []);

    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFiles(Array.from(e.target.files));
        }
    }, [handleFiles]);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
            handleFiles(files);
        }
    }, [handleFiles]);

    const clearImages = useCallback(() => {
        setImages([]);
    }, []);

    const removeImage = useCallback((index: number) => {
        setImages((prev) => {
            // Revoke the blob URL to free memory
            URL.revokeObjectURL(prev[index].src);
            return prev.filter((_, i) => i !== index);
        });
    }, []);

    // Drag handlers for rearranging images
    const handleImageDragStart = useCallback((e: ReactDragEvent<HTMLDivElement>, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Set transparent drag image
        const dragImage = document.createElement("div");
        dragImage.style.opacity = "0";
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        setTimeout(() => document.body.removeChild(dragImage), 0);
    }, []);

    const handleImageDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    }, [draggedIndex]);

    const handleImageDragLeave = useCallback(() => {
        setDragOverIndex(null);
    }, []);

    const handleImageDrop = useCallback((e: ReactDragEvent<HTMLDivElement>, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        setImages((prev) => {
            const newImages = [...prev];
            const [draggedItem] = newImages.splice(draggedIndex, 1);
            newImages.splice(dropIndex, 0, draggedItem);
            return newImages;
        });

        setDraggedIndex(null);
        setDragOverIndex(null);
    }, [draggedIndex]);

    const handleImageDragEnd = useCallback(() => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    }, []);

    const handleMusicUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploadedMusic(URL.createObjectURL(file));
            setUploadedMusicFile(file);
            setSelectedMusic(null); // Deselect preset if custom music is uploaded

            // Get duration
            getAudioDuration(URL.createObjectURL(file)).then(setAudioDuration);
        }
    }, []);

    const handlePresetSelect = (filename: string) => {
        if (selectedMusic === filename) {
            setSelectedMusic(null);
        } else {
            setSelectedMusic(filename);
            setUploadedMusic(null);
            setUploadedMusicFile(null);

            // Get duration for preset
            const preset = musicPresets.find(p => p.filename === filename);
            if (preset) {
                getAudioDuration(preset.url).then(setAudioDuration);
            }
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const uploadFileToS3 = async (file: File): Promise<string> => {
        // Get presigned URL
        const res = await fetch("/api/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                filename: file.name,
                contentType: file.type,
            }),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to get upload URL");
        }
        const { uploadUrl, fileUrl } = await res.json();

        // Upload to S3
        const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
        });

        if (!uploadRes.ok) throw new Error("Failed to upload file to S3");

        return fileUrl;
    };

    const handleGenerate = async (renderMode: 'lambda' | 'local' = 'lambda') => {
        setIsGenerating(true);
        setVideoUrl(null);
        setCdnUrl(null);
        setProgress(0);
        setRenderStatus("Initializing...");
        setElapsedTime(0);

        // Start timer
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setElapsedTime((prev) => prev + 1);
        }, 1000);

        try {
            let imagePayload: { src: string; color: string }[] = [];
            let audioUrl: string | null = null;

            if (renderMode === 'lambda') {
                setRenderStatus("Uploading assets...");
                // Upload images to S3 concurrently but maybe limit concurrency if needed?
                // For now, let's use a batched approach if possible, but Promise.all is existing pattern.
                // We'll stick to Promise.all but we map over `images` state now.
                
                const uploadedUrls = await Promise.all(images.map(async (img) => {
                     const url = await uploadFileToS3(img.file);
                     return { src: url, color: img.color };
                }));
                imagePayload = uploadedUrls;

                // Upload audio if custom file
                if (uploadedMusicFile) {
                    audioUrl = await uploadFileToS3(uploadedMusicFile);
                }
            } else {
                // Local mode: use base64
                const base64s = await Promise.all(images.map(async (img) => {
                    const b64 = await fileToBase64(img.file);
                    return { src: b64, color: img.color };
                }));
                imagePayload = base64s;

                if (uploadedMusicFile) {
                    audioUrl = await fileToBase64(uploadedMusicFile);
                }
            }

            let finalAudioDuration = audioDuration;
            if (audioLoop && !finalAudioDuration && (audioUrl || selectedMusic)) {
                // Try to get duration if missing
                const urlToCheck = uploadedMusic || (selectedMusic ? musicPresets.find(p => p.filename === selectedMusic)?.url : null);
                if (urlToCheck) {
                    console.log("[SlideshowPage] Audio duration missing, fetching for:", urlToCheck);
                    finalAudioDuration = await getAudioDuration(urlToCheck);
                    setAudioDuration(finalAudioDuration);
                }
            }

            const payload = {
                compositionId: "slideshow",
                images: imagePayload,
                durationPerSlide,
                animation: { frameRate: 30 },
                audioPreset: selectedMusic,
                audio: audioUrl,
                audioLoop,
                audioDuration: finalAudioDuration,
                renderMode,
            };
            console.log("[SlideshowPage] Generating with payload:", payload);

            setRenderStatus("Starting render...");
            const response = await fetch("/api/render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || "Failed to start render");
            }

            const data = await response.json();

            if (renderMode === 'lambda') {
                const { renderId, bucketName, functionName, region } = data;

                // Poll for progress
                while (true) {
                    await new Promise(r => setTimeout(r, 1000));
                    const statusRes = await fetch("/api/render/status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ renderId, bucketName, functionName, region }),
                    });

                    if (!statusRes.ok) continue;

                    const status = await statusRes.json();

                    if (status.fatalErrorEncountered) {
                        throw new Error(status.errors?.[0]?.message || "Render failed");
                    }

                    if (status.done) {
                        setVideoUrl(status.outputFile);
                        setProgress(1);
                        setRenderStatus("Done!");
                        toast.success("Render completed successfully!");
                        break;
                    }

                    setProgress(status.overallProgress);
                    setRenderStatus(`Rendering: ${Math.round(status.overallProgress * 100)}%`);
                }
            } else {
                // Local render returns URL directly
                setVideoUrl(data.url);
                toast.success("Render completed successfully!");
            }

        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : "Error generating video";
            toast.error(msg);
            setRenderStatus("Error");
        } finally {
            setIsGenerating(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handleUploadToCdn = async () => {
        if (!videoUrl) return;

        setIsCdnUploading(true);

        // Simulate upload delay
        setTimeout(() => {
            const absoluteUrl = window.location.origin + videoUrl;
            setCdnUrl(absoluteUrl);
            setIsCdnUploading(false);
        }, 1500);
    };

    const fps = 30;
    const durationInFrames = Math.max(
        1,
        Math.round((images.length * durationPerSlide) * fps)
    );

    // Determine audio source for preview
    const previewAudio = uploadedMusic || (selectedMusic ? musicPresets.find(p => p.filename === selectedMusic)?.url : undefined);

    // Filter images for player preview (just src and color)
    const playerImages = images.map(img => ({ src: img.src, color: img.color }));

    return (
        <div className="flex h-full overflow-hidden text-slate-900 dark:text-slate-100">
            <div className="flex flex-1 overflow-hidden">
                <aside className="flex w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 md:w-[280px] lg:w-[380px]">
                    {/* Media Panel */}
                    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/60">
                        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800 dark:text-slate-300">Media</h2>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400">Upload images.</p>
                            </div>
                            <button
                                type="button"
                                onClick={clearImages}
                                disabled={images.length === 0}
                                className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                            >
                                Clear
                            </button>
                        </header>

                        <div
                            className={`relative flex flex-col items-center justify-center rounded-xl border border-dashed p-6 transition-colors ${dragActive
                                ? "border-sky-400 bg-sky-500/10"
                                : "border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-slate-600"
                                }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex flex-col items-center justify-center text-center">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Drag & drop images</p>
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">or click to browse</p>
                            </div>
                        </div>

                        {images.length > 0 && (
                            <div className="mt-4 grid grid-cols-4 gap-2">
                                {images.map((img, i) => (
                                    <div
                                        key={i}
                                        draggable
                                        onDragStart={(e) => handleImageDragStart(e, i)}
                                        onDragOver={(e) => handleImageDragOver(e, i)}
                                        onDragLeave={handleImageDragLeave}
                                        onDrop={(e) => handleImageDrop(e, i)}
                                        onDragEnd={handleImageDragEnd}
                                        className={`group relative aspect-square rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all duration-150 ${
                                            draggedIndex === i
                                                ? "opacity-50 scale-95 border-sky-400"
                                                : dragOverIndex === i
                                                ? "border-sky-400 ring-2 ring-sky-400/50 scale-105"
                                                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                        }`}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={img.src}
                                            alt={`Slide ${i}`}
                                            className="w-full h-full object-cover pointer-events-none"
                                        />
                                        {/* Remove button */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeImage(i);
                                            }}
                                            className="absolute top-1 left-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 focus:opacity-100 focus:bg-red-500"
                                            title="Remove image"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                            </svg>
                                        </button>
                                        {/* Position number */}
                                        <div className="absolute bottom-0 right-0 bg-black/50 px-1.5 py-0.5 text-[9px] text-white backdrop-blur-sm rounded-tl">
                                            {i + 1}
                                        </div>
                                        {/* Color indicator */}
                                        <div
                                            className="absolute top-1 right-1 w-3 h-3 rounded-full border border-white/50 shadow-sm"
                                            style={{ backgroundColor: img.color }}
                                            title={`Dominant Color: ${img.color}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 text-center">
                            {images.length} image{images.length !== 1 ? 's' : ''} selected
                            {images.length > 1 && <span className="block text-[10px] mt-0.5 opacity-70">Drag to reorder • Hover and click ✕ to remove</span>}
                        </p>
                    </section>

                    {/* Settings Panel */}
                    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/60">
                        <header className="mb-3">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800 dark:text-slate-300">Settings</h2>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400">Customize your video.</p>
                        </header>

                        <div className="space-y-4">
                            <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
                                    Slide Duration
                                </span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="10"
                                        step="0.5"
                                        value={durationPerSlide}
                                        onChange={(e) => setDurationPerSlide(Number(e.target.value))}
                                        className="flex-1 accent-sky-500"
                                    />
                                    <span className="w-12 text-right text-xs font-mono text-slate-600 dark:text-slate-300">
                                        {durationPerSlide}s
                                    </span>
                                </div>
                            </label>

                            <div className="flex flex-col gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
                                    Background Music
                                </span>

                                {/* Upload Music */}
                                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:bg-slate-900/50">
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleMusicUpload}
                                        className="hidden"
                                    />
                                    <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 truncate">
                                        {uploadedMusicFile ? `Uploaded: ${uploadedMusicFile.name}` : "Upload audio file"}
                                    </span>
                                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        Browse
                                    </span>
                                </label>

                                {/* Preset Library */}
                                <div className="mt-2 space-y-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-500">
                                        Library
                                    </span>
                                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                                        {musicPresets.map((preset) => (
                                            <button
                                                key={preset.id}
                                                onClick={() => handlePresetSelect(preset.filename)}
                                                className={`w-full truncate rounded-lg border px-3 py-2 text-left text-xs transition-colors ${selectedMusic === preset.filename
                                                    ? "border-sky-400 bg-sky-500/20 text-sky-700 dark:text-sky-100"
                                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-slate-900"
                                                    }`}
                                            >
                                                {preset.name}
                                            </button>
                                        ))}
                                        {musicPresets.length === 0 && (
                                            <p className="text-center text-[10px] italic text-slate-400">No presets found.</p>
                                        )}
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 mt-4">
                                    <input
                                        type="checkbox"
                                        checked={audioLoop}
                                        onChange={(e) => setAudioLoop(e.target.checked)}
                                        className="h-3 w-3 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950/60"
                                    />
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
                                        Loop audio {audioDuration ? `(${audioDuration.toFixed(1)}s)` : "(?)"}
                                    </span>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* Export Panel */}
                    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/60">
                        <header className="mb-3">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800 dark:text-slate-300">Export</h2>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400">Render and download.</p>
                        </header>

                        <div className="flex flex-col gap-2">
                            {isGenerating ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                                    <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-slate-500">
                                        <span>{renderStatus}</span>
                                        <span className="font-mono">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                        <div
                                            className="h-full bg-sky-500 transition-all duration-300 ease-out"
                                            style={{ width: `${Math.max(5, progress * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => handleGenerate('lambda')}
                                        disabled={images.length === 0}
                                        className="w-full inline-flex items-center justify-center rounded-full bg-sky-500/15 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-700 shadow-inner shadow-sky-500/20 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20"
                                    >
                                        Render with Lambda
                                    </button>
                                    <button
                                        onClick={() => handleGenerate('local')}
                                        disabled={images.length === 0}
                                        className="w-full inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    >
                                        Render Locally
                                    </button>
                                </>
                            )}
                        </div>

                        {videoUrl && (
                            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center dark:border-emerald-900/50 dark:bg-emerald-900/20">
                                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Video Ready!</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <a
                                        href={videoUrl}
                                        download
                                        className="w-full inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        Download MP4
                                    </a>
                                    <button
                                        onClick={handleUploadToCdn}
                                        disabled={isCdnUploading}
                                        className="w-full inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {isCdnUploading ? "Uploading..." : "Upload to CDN"}
                                    </button>
                                </div>

                                {cdnUrl && (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                                        <p className="mb-1 text-[10px] font-medium uppercase text-slate-500">CDN Link</p>
                                        <div className="flex gap-1">
                                            <input
                                                readOnly
                                                value={cdnUrl}
                                                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                                onClick={(e) => e.currentTarget.select()}
                                            />
                                            <button
                                                onClick={() => navigator.clipboard.writeText(cdnUrl)}
                                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </aside>

                <main className="flex flex-1 flex-col items-center justify-center overflow-hidden bg-slate-100 p-8 dark:bg-slate-950">
                    <div className="relative flex aspect-[9/16] h-full max-h-[800px] w-auto flex-col overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-slate-900/10 dark:ring-slate-100/10">
                        <Player
                            component={SlideshowComposition}
                            inputProps={{
                                images: playerImages,
                                durationPerSlide,
                                audio: previewAudio,
                            }}
                            durationInFrames={durationInFrames}
                            fps={fps}
                            compositionWidth={1080}
                            compositionHeight={1920}
                            style={{
                                width: "100%",
                                height: "100%",
                            }}
                            controls
                        />
                    </div>
                    <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
                        Preview (9:16 Vertical) • {Math.round(durationInFrames / fps)}s
                    </p>
                </main>
            </div>
        </div>
    );
}
