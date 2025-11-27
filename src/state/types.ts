export interface UploadedImage {
  id: string;
  file: File;
  src: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface PhotoPair {
  id: string;
  top?: UploadedImage;
  bottom?: UploadedImage;
}

export interface UploadedAudio {
  id: string;
  file?: File;
  src: string;
  name: string;
  origin: "upload" | "preset";
  duration?: number;
}

export interface OverlayTextStyle {
  markdown: string;
  position: { xPct: number; yPct: number };
  maxWidthPct: number;
  fontFamily: string;
  fontSizePx: number;
  color: string;
  background?: string;
  align: "left" | "center" | "right";
  borderColor: string;
  borderWidthPx: number;
  borderStyle: "none" | "solid" | "dashed" | "dotted";
  borderRadiusPx: number;
}

export interface CompareSettings {
  sliderPct: number;
  orientation: "vertical" | "horizontal";
  showDivider: boolean;
}

export interface ExportOptions {
  format: "png" | "jpeg" | "webp" | "mp4";
  quality: number;
  includeBackground: boolean;
  size: "original" | "canvas";
}

export type VideoCodec = "webm-vp9" | "webm-vp8" | "mp4-h264";

export type EasingKind = "linear" | "easeIn" | "easeOut" | "easeInOut";

export interface AnimationSettings {
  durationMs: number;
  frameRate: number;
  easing: EasingKind;
  direction: "forward" | "reverse" | "pingpong";
}

export type Theme = "light" | "dark";

export interface VideoResolution {
  width: number;
  height: number;
}

export interface VideoExportOptions {
  codec: VideoCodec;
  bitrateKbps?: number;
  fileName?: string;
  resolution: VideoResolution;
}

export interface AppState {
  photoPairs: PhotoPair[];
  activePairIndex: number;
  audio?: UploadedAudio;
  audioLoop: boolean;
  overlay: OverlayTextStyle;
  compare: CompareSettings;
  exportOptions: ExportOptions;
  animation: AnimationSettings;
  video: VideoExportOptions;
  theme: Theme;
}
