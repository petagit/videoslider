/* eslint-disable @next/next/no-img-element */
"use client";

import { ChangeEvent, DragEvent, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "../state/store";
import type { UploadedImage } from "../state/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { ImagePlus, Trash2, X, RotateCw, Spline } from "lucide-react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const MAX_PAIRS = 4;
const PREVIEW_SIZE_CLASS = "h-32";

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

const ImagePreview = ({ image }: { image?: UploadedImage }) => {
  if (!image) {
    return (
      <div
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted",
          PREVIEW_SIZE_CLASS
        )}
      >
        <ImagePlus className="h-5 w-5 opacity-50" />
        <div className="flex flex-col items-center gap-0.5">
          <span>Drop image</span>
          <span className="text-[10px] uppercase tracking-wider opacity-70">or browse</span>
        </div>
      </div>
    );
  }

  return <img src={image.src} alt={image.alt} className={cn(PREVIEW_SIZE_CLASS, "w-full rounded-lg object-cover")} />;
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

  const assignImages = useCallback(
    async (startPairIndex: number, startSlot: SlotKind, files: File[]) => {
      const validFiles = files.filter((file) => ACCEPTED_TYPES.includes(file.type));
      if (validFiles.length === 0) return;

      const images = await Promise.all(validFiles.map(buildUploadedImage));

      let currentPairIndex = startPairIndex;
      let currentSlot = startSlot;

      for (const image of images) {
        if (currentPairIndex >= MAX_PAIRS) break;

        const currentPairs = useAppStore.getState().photoPairs;
        if (currentPairIndex >= currentPairs.length) {
          addPhotoPair();
        }

        setPhotoAt(currentPairIndex, currentSlot, image);

        if (currentSlot === "top") {
          currentSlot = "bottom";
        } else {
          currentSlot = "top";
          currentPairIndex++;
        }
      }
    },
    [addPhotoPair, setPhotoAt],
  );

  const handleFileInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>, pairIndex: number, slot: SlotKind) => {
      const files = Array.from(event.target.files ?? []);
      await assignImages(pairIndex, slot, files);
      event.target.value = "";
    },
    [assignImages],
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLLabelElement>, pairIndex: number, slot: SlotKind) => {
      event.preventDefault();
      setDragTarget(null);
      const files = Array.from(event.dataTransfer.files ?? []);
      await assignImages(pairIndex, slot, files);
    },
    [assignImages],
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

  // Handle paste events
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (!isModalOpen) return;

      const items = Array.from(event.clipboardData?.items ?? []);
      const imageFiles = items
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (imageFiles.length === 0) return;

      event.preventDefault();

      // Find the first empty slot
      let startPairIndex = 0;
      let startSlot: SlotKind = "top";
      let foundEmpty = false;

      const currentPairs = useAppStore.getState().photoPairs;

      for (let i = 0; i < currentPairs.length; i++) {
        if (!currentPairs[i].top) {
          startPairIndex = i;
          startSlot = "top";
          foundEmpty = true;
          break;
        }
        if (!currentPairs[i].bottom) {
          startPairIndex = i;
          startSlot = "bottom";
          foundEmpty = true;
          break;
        }
      }

      if (!foundEmpty) {
        startPairIndex = currentPairs.length;
        startSlot = "top";
      }

      await assignImages(startPairIndex, startSlot, imageFiles);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [assignImages, isModalOpen]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Media</CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-xs uppercase tracking-wider"
                >
                  Manage
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Media Library</DialogTitle>
                  <DialogDescription>
                    Drag and drop images into slots or click to browse. Up to {MAX_PAIRS} pairs supported.
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {displayPairs.map((pair, index) => {
                      const isActive = activePairIndex === index;
                      return (
                        <div
                          key={pair.id}
                          className={cn(
                            "flex flex-col gap-3 rounded-xl border bg-card p-3 transition-colors",
                            isActive ? "border-primary ring-1 ring-primary/20" : "border-border"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Pair {index + 1}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant={isActive ? "default" : "ghost"}
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setActivePairIndex(index)}
                                title="Preview this pair"
                              >
                                <Spline className="h-3 w-3" />
                              </Button>
                              {photoPairs.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => removePhotoPair(index)}
                                  title="Remove pair"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {/* Top Image */}
                            <div className="space-y-1">
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                Photo 1
                              </span>
                              <label
                                onDrop={(event) => void handleDrop(event, index, "top")}
                                onDragOver={(event) => handleDragOver(event, index, "top")}
                                onDragLeave={handleDragLeave}
                                className={cn(
                                  "group relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors",
                                  dragTarget?.pairIndex === index && dragTarget.slot === "top"
                                    ? "border-primary bg-primary/5"
                                    : "border-transparent hover:border-muted-foreground/25"
                                )}
                              >
                                <input
                                  type="file"
                                  accept={ACCEPTED_TYPES.join(",")}
                                  multiple
                                  className="hidden"
                                  onChange={(event) => void handleFileInput(event, index, "top")}
                                />
                                <ImagePreview image={pair.top} />
                                {pair.top && (
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="absolute right-2 top-2 h-6 w-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                                    onClick={(event) => handleRemoveImage(event, index, "top")}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </label>
                            </div>

                            {/* Bottom Image */}
                            <div className="space-y-1">
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                Photo 2
                              </span>
                              <label
                                onDrop={(event) => void handleDrop(event, index, "bottom")}
                                onDragOver={(event) => handleDragOver(event, index, "bottom")}
                                onDragLeave={handleDragLeave}
                                className={cn(
                                  "group relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors",
                                  dragTarget?.pairIndex === index && dragTarget.slot === "bottom"
                                    ? "border-primary bg-primary/5"
                                    : "border-transparent hover:border-muted-foreground/25"
                                )}
                              >
                                <input
                                  type="file"
                                  accept={ACCEPTED_TYPES.join(",")}
                                  multiple
                                  className="hidden"
                                  onChange={(event) => void handleFileInput(event, index, "bottom")}
                                />
                                <ImagePreview image={pair.bottom} />
                                {pair.bottom && (
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="absolute right-2 top-2 h-6 w-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                                    onClick={(event) => handleRemoveImage(event, index, "bottom")}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </label>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <div className="flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addPhotoPair}
                      disabled={!canAddPair}
                      className="gap-2"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Add Pair
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {photoPairs.length}/{MAX_PAIRS} pairs
                    </span>
                  </div>
                  <Button onClick={() => setIsModalOpen(false)}>Done</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearImages}
              className="h-7 px-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive"
            >
              Clear
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">Upload and manage photo pairs.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{readyPairCount}/{photoPairs.length}</span>
              <span>ready</span>
            </div>
            <span>Current: Pair {activePairNumber}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {photoPairs.map((pair, index) => {
              const isActive = activePairIndex === index;
              const isComplete = Boolean(pair.top && pair.bottom);
              return (
                <button
                  key={pair.id}
                  onClick={() => setActivePairIndex(index)}
                  className={cn(
                    "group flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-background text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  <span>{index + 1}</span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isComplete ? "bg-emerald-500" : "bg-amber-500"
                    )}
                  />
                </button>
              );
            })}
          </div>

          {hasIncompletePair ? (
            <p className="mt-3 flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Incomplete pairs will be skipped.
            </p>
          ) : (
            <p className="mt-3 text-[11px] text-muted-foreground">All pairs ready for export.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Orientation
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setOrientation(compare.orientation === "vertical" ? "horizontal" : "vertical")}
              >
                <RotateCw className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs font-medium">
              {compare.orientation === "vertical" ? "Vertical" : "Horizontal"}
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Divider
              </span>
              <Button
                variant={compare.showDivider ? "default" : "secondary"}
                size="sm"
                className="h-6 px-2 text-[10px] uppercase tracking-wider"
                onClick={toggleDivider}
              >
                {compare.showDivider ? "On" : "Off"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {compare.showDivider ? "Visible" : "Hidden"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
