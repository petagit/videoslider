"use client";

import React, { useState, useCallback, useEffect, useRef, DragEvent as ReactDragEvent } from "react";
import { Player } from "@remotion/player";
import { SlideshowComposition } from "../../../remotion/SlideshowComposition";
import { toast } from "sonner";
import { resizeImage } from "@/lib/image-processing";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    X,
    Upload,
    Music,
    Download,
    Play,
    Pause,
    Film,
    Loader2,
    Copy,
    Check
} from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    const [aspectRatio, setAspectRatio] = useState("9:16");
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

    const [previewingAudio, setPreviewingAudio] = useState<string | null>(null);
    const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        return () => {
            if (audioPreviewRef.current) {
                audioPreviewRef.current.pause();
            }
        };
    }, []);

    const togglePreview = (url: string, id: string) => {
        if (previewingAudio === id) {
            // Stop
            if (audioPreviewRef.current) {
                audioPreviewRef.current.pause();
                audioPreviewRef.current = null;
            }
            setPreviewingAudio(null);
        } else {
            // Start new
            if (audioPreviewRef.current) {
                audioPreviewRef.current.pause();
            }
            const audio = new Audio(url);
            audio.onended = () => setPreviewingAudio(null);
            audio.play().catch(e => console.error("Playback failed", e));
            audioPreviewRef.current = audio;
            setPreviewingAudio(id);
        }
    };

    useEffect(() => {
        fetch("/api/music-presets")
            .then((res) => res.json())
            .then((data) => setMusicPresets(data.presets))
            .catch((err) => console.error("Failed to load music presets", err));
    }, []);

    const handleFiles = useCallback(async (files: File[]) => {
        const newImages = await Promise.all(files.map(async (file) => {
            try {
                // Resize if > 1920x1920 to prevent stack overflow/memory issues
                const resizedFile = await resizeImage(file, 1920, 1920);
                const src = URL.createObjectURL(resizedFile);
                const color = await extractColor(src);
                return { src, color, file: resizedFile };
            } catch (error) {
                console.error("Failed to process image:", file.name, error);
                toast.error(`Failed to process ${file.name}`);
                return null;
            }
        }));

        setImages((prev) => [...prev, ...newImages.filter((img): img is SlideImage => img !== null)]);
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

    const triggerDownload = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = url.split('/').pop() || 'video.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

                let uploadedUrls;
                try {
                    uploadedUrls = await Promise.all(images.map(async (img) => {
                        const url = await uploadFileToS3(img.file);
                        return { src: url, color: img.color };
                    }));
                } catch (err) {
                    console.error("Upload failed:", err);
                    if (err instanceof Error && err.message.includes("Failed to fetch")) {
                        throw new Error("Upload failed. This is likely a CORS issue. Please run 'npm run update-cors' in your terminal to fix your S3 bucket configuration.");
                    }
                    throw err;
                }
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
                aspectRatio,
            };

            // Log payload without massive base64 strings
            console.log("[SlideshowPage] Generating with payload:", {
                ...payload,
                images: payload.images.map(img =>
                    typeof img === 'object' && img.src && img.src.length > 100
                        ? { ...img, src: `[Base64 string length: ${img.src.length}]` }
                        : img
                ),
                audio: payload.audio && payload.audio.length > 100 ? `[Base64/URL length: ${payload.audio.length}]` : payload.audio
            });

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
                        triggerDownload(status.outputFile);
                        break;
                    }

                    setProgress(status.overallProgress);
                    setRenderStatus(`Rendering: ${Math.round(status.overallProgress * 100)}%`);
                }
            } else {
                // Local render returns URL directly
                // Convert to API download URL to avoid 404s and ensure download
                const filename = data.url.split('/').pop();
                const apiDownloadUrl = `/api/download-local?file=${filename}`;

                // If we prefer direct link if available:
                // setVideoUrl(data.url); 
                // But user reported 404 issues, so API route is safer.
                setVideoUrl(apiDownloadUrl);
                setRenderStatus("Done!");
                toast.success("Render completed successfully!");
                triggerDownload(apiDownloadUrl);
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
        <div className="h-screen overflow-hidden bg-background text-foreground">
            <ResizablePanelGroup direction="horizontal" autoSaveId="video-editor-slideshow-layout">
                <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="bg-muted/30">
                    <ScrollArea className="h-full">
                        <div className="flex min-w-0 flex-col gap-6 p-4">
                            {/* Media Panel */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Media</CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearImages}
                                            disabled={images.length === 0}
                                            className="h-6 px-2 text-xs uppercase tracking-wider"
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                    <CardDescription className="text-xs">Upload and arrange your images.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div
                                        className={cn(
                                            "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                                            dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                                        )}
                                        onDragEnter={handleDrag}
                                        onDragLeave={handleDrag}
                                        onDragOver={handleDrag}
                                        onDrop={handleDrop}
                                    >
                                        <Input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                        />
                                        <div className="flex flex-col items-center justify-center text-center space-y-2">
                                            <div className="rounded-full bg-muted p-2">
                                                <Upload className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium">Drag & drop images</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">or click to browse</p>
                                            </div>
                                        </div>
                                    </div>

                                    {images.length > 0 && (
                                        <div className="mt-4 grid grid-cols-3 gap-2">
                                            {images.map((img, i) => (
                                                <div
                                                    key={i}
                                                    draggable
                                                    onDragStart={(e) => handleImageDragStart(e, i)}
                                                    onDragOver={(e) => handleImageDragOver(e, i)}
                                                    onDragLeave={handleImageDragLeave}
                                                    onDrop={(e) => handleImageDrop(e, i)}
                                                    onDragEnd={handleImageDragEnd}
                                                    className={cn(
                                                        "group relative aspect-square overflow-hidden rounded-md border bg-background transition-all",
                                                        draggedIndex === i ? "opacity-50 ring-2 ring-primary" : "",
                                                        dragOverIndex === i ? "scale-105 ring-2 ring-primary" : "hover:border-primary/50"
                                                    )}
                                                >
                                                    <img
                                                        src={img.src}
                                                        alt={`Slide ${i}`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeImage(i);
                                                        }}
                                                        className="absolute left-1 top-1 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                    <div className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1.5 py-0.5 text-[9px] text-white backdrop-blur-sm">
                                                        {i + 1}
                                                    </div>
                                                    <div
                                                        className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-white/50 shadow-sm"
                                                        style={{ backgroundColor: img.color }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p className="mt-3 text-center text-[10px] text-muted-foreground">
                                        {images.length} image{images.length !== 1 ? 's' : ''} selected
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Settings Panel */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Settings</CardTitle>
                                    <CardDescription className="text-xs">Customize duration and audio.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Slide Duration</Label>
                                            <span className="font-mono text-xs text-muted-foreground">{durationPerSlide}s</span>
                                        </div>
                                        <Slider
                                            min={0.5}
                                            max={10}
                                            step={0.5}
                                            value={[durationPerSlide]}
                                            onValueChange={([val]) => setDurationPerSlide(val)}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aspect Ratio</Label>
                                        <Select value={aspectRatio} onValueChange={setAspectRatio}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select aspect ratio" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="9:16">Portrait (9:16) - TikTok/Reels</SelectItem>
                                                <SelectItem value="16:9">Landscape (16:9) - YouTube</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Separator />

                                    <div className="space-y-3">
                                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Background Music</Label>

                                        <div className="relative">
                                            <Input
                                                type="file"
                                                accept="audio/*"
                                                onChange={handleMusicUpload}
                                                className="hidden"
                                                id="music-upload"
                                            />
                                            <Label
                                                htmlFor="music-upload"
                                                className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-muted/50 p-2 hover:bg-muted"
                                            >
                                                <Music className="h-4 w-4 text-muted-foreground" />
                                                <span className="flex-1 truncate text-xs text-muted-foreground">
                                                    {uploadedMusicFile ? uploadedMusicFile.name : "Upload audio file"}
                                                </span>
                                                <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                    Browse
                                                </span>
                                            </Label>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Library</span>
                                            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                                                {musicPresets.map((preset) => (
                                                    <div key={preset.id} className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 shrink-0"
                                                            onClick={() => togglePreview(preset.url, preset.id)}
                                                        >
                                                            {previewingAudio === preset.id ? (
                                                                <Pause className="h-3 w-3" />
                                                            ) : (
                                                                <Play className="h-3 w-3 ml-0.5" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant={selectedMusic === preset.filename ? "secondary" : "ghost"}
                                                            className={cn(
                                                                "h-8 flex-1 justify-start text-xs",
                                                                selectedMusic === preset.filename && "bg-primary/10 text-primary hover:bg-primary/20"
                                                            )}
                                                            onClick={() => handlePresetSelect(preset.filename)}
                                                        >
                                                            {preset.name}
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="audio-loop"
                                                checked={audioLoop}
                                                onChange={(e) => setAudioLoop(e.target.checked)}
                                                className="h-3.5 w-3.5 rounded border-primary text-primary focus:ring-primary"
                                            />
                                            <Label htmlFor="audio-loop" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                                Loop audio {audioDuration ? `(${audioDuration.toFixed(1)}s)` : ""}
                                            </Label>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Export Panel */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Export</CardTitle>
                                    <CardDescription className="text-xs">Render and download your video.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {isGenerating ? (
                                        <div className="rounded-lg border bg-muted/50 p-4">
                                            <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                                <span className="flex items-center gap-2">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    {renderStatus}
                                                </span>
                                                <span className="font-mono">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
                                            </div>
                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full bg-primary transition-all duration-300 ease-out"
                                                    style={{ width: `${Math.max(5, progress * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            <Button
                                                onClick={() => handleGenerate('lambda')}
                                                disabled={images.length === 0}
                                                className="w-full"
                                            >
                                                <Film className="mr-2 h-4 w-4" />
                                                Render with Lambda
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => handleGenerate('local')}
                                                disabled={images.length === 0}
                                                className="w-full"
                                            >
                                                Render Locally
                                            </Button>
                                        </div>
                                    )}

                                    {videoUrl && (
                                        <div className="animate-in fade-in slide-in-from-top-2 space-y-3">
                                            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
                                                <p className="flex items-center justify-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                    <Check className="h-3 w-3" />
                                                    Video Ready!
                                                </p>
                                            </div>
                                            <div className="grid gap-2">
                                                <Button
                                                    variant="secondary"
                                                    asChild
                                                    className="w-full cursor-pointer"
                                                >
                                                    <a href={videoUrl} download>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Download MP4
                                                    </a>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={handleUploadToCdn}
                                                    disabled={isCdnUploading}
                                                    className="w-full"
                                                >
                                                    {isCdnUploading ? (
                                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Upload className="mr-2 h-3 w-3" />
                                                    )}
                                                    {isCdnUploading ? "Uploading..." : "Upload to CDN"}
                                                </Button>
                                            </div>

                                            {cdnUrl && (
                                                <div className="rounded-md border bg-muted/50 p-2">
                                                    <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">CDN Link</p>
                                                    <div className="flex gap-1">
                                                        <Input
                                                            readOnly
                                                            value={cdnUrl}
                                                            className="h-7 text-xs"
                                                            onClick={(e) => e.currentTarget.select()}
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(cdnUrl);
                                                                toast.success("Copied to clipboard");
                                                            }}
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </ScrollArea>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={75}>
                    <div className="flex h-full flex-col overflow-hidden bg-background">
                        <div className="flex-1 bg-muted/10 p-8 flex items-center justify-center">
                            <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-lg border bg-background shadow-sm">
                                <Player
                                    component={SlideshowComposition}
                                    inputProps={{
                                        images: playerImages,
                                        durationPerSlide,
                                        audioUrl: previewAudio,
                                    }}
                                    durationInFrames={durationInFrames}
                                    fps={fps}
                                    compositionWidth={1920}
                                    compositionHeight={1080}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                    }}
                                    controls
                                />
                            </div>
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
