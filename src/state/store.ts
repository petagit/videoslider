import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AnimationSettings,
  AppState,
  CompareSettings,
  ExportOptions,
  OverlayTextStyle,
  PhotoPair,
  UploadedImage,
  VideoExportOptions,
  Theme,
} from "./types";

const defaultOverlay: OverlayTextStyle = {
  markdown: "## Overlay headline\nAdd *Markdown* to annotate your comparison.",
  position: { xPct: 50, yPct: 50 },
  maxWidthPct: 60,
  fontFamily: "'Geist', 'Geist Variable', 'Helvetica Neue', Arial, sans-serif",
  fontSizePx: 64,
  color: "#ffffff",
  background: undefined,
  align: "center",
  borderColor: "#000000",
  borderWidthPx: 2,
  borderStyle: "solid",
  borderRadiusPx: 24,
};

const defaultCompare: CompareSettings = {
  sliderPct: 50,
  orientation: "vertical",
  showDivider: true,
};

const defaultExport: ExportOptions = {
  format: "mp4",
  quality: 0.92,
  includeBackground: true,
  size: "canvas",
};

const defaultAnimation: AnimationSettings = {
  durationMs: 11000,
  frameRate: 30,
  easing: "easeInOut",
  direction: "forward",
};

const defaultVideo: VideoExportOptions = {
  codec: "webm-vp9",
  resolution: { width: 1920, height: 1080 },
  bitrateKbps: 4500,
  fileName: "slider-reveal",
};

export interface AppStore extends AppState {
  setPhotoAt: (index: number, slot: "top" | "bottom", image?: UploadedImage) => void;
  addPhotoPair: () => void;
  removePhotoPair: (index: number) => void;
  setActivePairIndex: (index: number) => void;
  clearImages: () => void;
  setSliderPct: (pct: number) => void;
  setOrientation: (orientation: CompareSettings["orientation"]) => void;
  toggleDivider: () => void;
  setOverlayMarkdown: (markdown: string) => void;
  setOverlayFontSize: (size: number) => void;
  setOverlayColor: (color: string) => void;
  setOverlayMaxWidth: (pct: number) => void;
  setOverlayAlignment: (align: OverlayTextStyle["align"]) => void;
  setOverlayBackground: (background?: string) => void;
  setOverlayBorder: (update: Partial<Pick<OverlayTextStyle, "borderColor" | "borderWidthPx" | "borderStyle" | "borderRadiusPx">>) => void;
  setExportFormat: (format: ExportOptions["format"]) => void;
  setAudio: (audio: AppState["audio"]) => void;
  setAnimationDuration: (durationMs: number) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pair-${Math.random().toString(36).slice(2, 11)}`;
};

const createEmptyPhotoPair = (): PhotoPair => ({
  id: generateId(),
  top: undefined,
  bottom: undefined,
});

const revokeIfObjectUrl = (image?: UploadedImage) => {
  if (image?.src.startsWith("blob:")) {
    URL.revokeObjectURL(image.src);
  }
};

const revokePairUrls = (pair?: PhotoPair) => {
  if (!pair) return;
  revokeIfObjectUrl(pair.top);
  revokeIfObjectUrl(pair.bottom);
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      photoPairs: [createEmptyPhotoPair()],
      activePairIndex: 0,
      overlay: defaultOverlay,
      compare: defaultCompare,
      exportOptions: defaultExport,
      animation: defaultAnimation,
      video: defaultVideo,
      audio: undefined,
      theme: "dark",
      setPhotoAt: (index, slot, image) =>
        set((state) => {
          const pair = state.photoPairs[index];
          if (!pair) {
            return state;
          }

          const previous = pair[slot];
          if (previous && previous.id !== image?.id) {
            revokeIfObjectUrl(previous);
          }

          const updatedPairs = state.photoPairs.slice();
          updatedPairs[index] = { ...pair, [slot]: image };
          return { photoPairs: updatedPairs };
        }),
      addPhotoPair: () =>
        set((state) => ({
          photoPairs: [...state.photoPairs, createEmptyPhotoPair()],
          activePairIndex: state.photoPairs.length,
        })),
      removePhotoPair: (index) =>
        set((state) => {
          const pair = state.photoPairs[index];
          if (!pair) {
            return state;
          }

          revokePairUrls(pair);
          const nextPairs = state.photoPairs.filter((_, i) => i !== index);
          if (nextPairs.length === 0) {
            nextPairs.push(createEmptyPhotoPair());
          }

          let nextActive = state.activePairIndex;
          if (state.activePairIndex === index) {
            nextActive = Math.min(index, nextPairs.length - 1);
          } else if (state.activePairIndex > index) {
            nextActive = Math.max(0, state.activePairIndex - 1);
          } else {
            nextActive = Math.min(nextActive, nextPairs.length - 1);
          }

          return {
            photoPairs: nextPairs,
            activePairIndex: nextActive,
          };
        }),
      setActivePairIndex: (index) =>
        set((state) => ({
          activePairIndex: Math.min(Math.max(index, 0), Math.max(state.photoPairs.length - 1, 0)),
        })),
      setAudio: (audio) =>
        set(() => ({
          audio,
        })),
      clearImages: () =>
        set((state) => {
          state.photoPairs.forEach(revokePairUrls);
          return { photoPairs: [createEmptyPhotoPair()], activePairIndex: 0 };
        }),
      setSliderPct: (pct) =>
        set((state) => ({
          compare: { ...state.compare, sliderPct: Math.min(100, Math.max(0, pct)) },
        })),
      setOrientation: (orientation) =>
        set((state) => ({ compare: { ...state.compare, orientation } })),
      toggleDivider: () =>
        set((state) => ({ compare: { ...state.compare, showDivider: !state.compare.showDivider } })),
      setOverlayMarkdown: (markdown) =>
        set((state) => ({ overlay: { ...state.overlay, markdown } })),
      setOverlayFontSize: (size) =>
        set((state) => ({ overlay: { ...state.overlay, fontSizePx: size } })),
      setOverlayColor: (color) =>
        set((state) => ({ overlay: { ...state.overlay, color } })),
      setOverlayMaxWidth: (pct) =>
        set((state) => ({ overlay: { ...state.overlay, maxWidthPct: pct } })),
      setOverlayAlignment: (align) =>
        set((state) => ({ overlay: { ...state.overlay, align } })),
      setOverlayBackground: (background) =>
        set((state) => ({ overlay: { ...state.overlay, background } })),
      setOverlayBorder: (update) =>
        set((state) => ({ overlay: { ...state.overlay, ...update } })),
      setExportFormat: (format) =>
        set((state) => ({ exportOptions: { ...state.exportOptions, format } })),
      setAnimationDuration: (durationMs) =>
        set((state) => ({ animation: { ...state.animation, durationMs } })),
      setTheme: (theme) =>
        set(() => ({ theme })),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
    }),
    {
      name: "video-editor-store",
      storage: typeof window !== "undefined" ? createJSONStorage(() => localStorage) : undefined,
      partialize: (state) => ({
        overlay: state.overlay,
      }),
    },
  ),
);
