"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Player } from "@remotion/player";
import { SlideshowComposition } from "../../../remotion/SlideshowComposition";
import { toast } from "sonner";

interface MusicPreset {
    id: string;
    name: string;
    filename: string;
    url: string;
}

export default function SlideshowPage() {
    const [images, setImages] = useState<string[]>([]);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [durationPerSlide, setDurationPerSlide] = useState(1.5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [musicPresets, setMusicPresets] = useState<MusicPreset[]>([]);
    const [selectedMusic, setSelectedMusic] = useState<string | null>(null);
    const [uploadedMusic, setUploadedMusic] = useState<string | null>(null);
    const [uploadedMusicFile, setUploadedMusicFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [isCdnUploading, setIsCdnUploading] = useState(false);
    const [cdnUrl, setCdnUrl] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [renderStatus, setRenderStatus] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        fetch("/api/music-presets")
            .then((res) => res.json())
            .then((data) => setMusicPresets(data.presets))
            .catch((err) => console.error("Failed to load music presets", err));
    }, []);

    const handleFiles = useCallback((files: File[]) => {
        const newImages = files.map((file) => URL.createObjectURL(file));
        setImages((prev) => [...prev, ...newImages]);
        setImageFiles((prev) => [...prev, ...files]);
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
        setImageFiles([]);
    }, []);

    const handleMusicUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploadedMusic(URL.createObjectURL(file));
            setUploadedMusicFile(file);
            setSelectedMusic(null); // Deselect preset if custom music is uploaded
        }
    }, []);

    const handlePresetSelect = (filename: string) => {
        if (selectedMusic === filename) {
            setSelectedMusic(null);
        } else {
            setSelectedMusic(filename);
            setUploadedMusic(null);
            setUploadedMusicFile(null);
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

        if (!res.ok) throw new Error("Failed to get upload URL");
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
            let imageUrls: string[] = [];
            let audioUrl: string | null = null;

            if (renderMode === 'lambda') {
                setRenderStatus("Uploading assets...");
                // Upload images to S3
                imageUrls = await Promise.all(imageFiles.map(uploadFileToS3));

                // Upload audio if custom file
                if (uploadedMusicFile) {
                    audioUrl = await uploadFileToS3(uploadedMusicFile);
                }
            } else {
                // Local mode: use base64 as before
                imageUrls = await Promise.all(imageFiles.map(fileToBase64));
                if (uploadedMusicFile) {
                    audioUrl = await fileToBase64(uploadedMusicFile);
                }
            }

            const payload = {
                compositionId: "slideshow",
                images: imageUrls,
                durationPerSlide,
                animation: { frameRate: 30 },
                audioPreset: selectedMusic,
                audio: audioUrl,
                renderMode,
            };

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
                                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img} alt={`Slide ${i}`} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white backdrop-blur-sm">
                                            {i + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 text-center">
                            {images.length} image{images.length !== 1 ? 's' : ''} selected
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
                                images,
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
