import type {
  FC,
  ReactNode,
  CSSProperties,
  DetailedHTMLProps,
  ImgHTMLAttributes,
} from "react";

type CompositionMetadata = {
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
};

type CompositionProps<T extends object = Record<string, unknown>> = {
  id: string;
  component: FC<T>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  defaultProps?: Partial<T>;
  calculateMetadata?: (options: { props: T }) => CompositionMetadata | Promise<CompositionMetadata>;
};

declare module "remotion" {
  export const AbsoluteFill: FC<{ style?: CSSProperties; children?: ReactNode }>;
  export const Audio: FC<{
    src: string;
    volume?: number;
    startFrom?: number;
    endAt?: number;
    muted?: boolean;
    loop?: boolean;
    playbackRate?: number;
    trimBefore?: number; // Legacy or custom
    trimAfter?: number; // Legacy or custom
    useWebAudioApi?: boolean;
  }>;
  export const Img: FC<
    DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement> & { src: string }
  >;
  export const Sequence: FC<{
    from: number;
    durationInFrames?: number;
    layout?: "absolute-fill" | "none";
    style?: CSSProperties;
    children?: ReactNode;
    name?: string;
  }>;
  export function Composition<T extends object = Record<string, unknown>>(
    props: CompositionProps<T>
  ): ReactNode;

  export function registerRoot(root: FC): void;
  export function useVideoConfig(): {
    durationInFrames: number;
    width: number;
    height: number;
    fps: number;
    id: string;
  };
  export function useCurrentFrame(): number;
  export function delayRender(handle?: string): number;
  export function continueRender(handle: number): void;
  export function staticFile(path: string): string;
  export function interpolate(
    input: number,
    inputRange: number[],
    outputRange: number[],
    options?: { easing?: (t: number) => number; extrapolateLeft?: "clamp" | "extend" | "identity"; extrapolateRight?: "clamp" | "extend" | "identity" }
  ): number;
  export function spring(config: {
    frame: number;
    fps: number;
    config?: {
      damping?: number;
      mass?: number;
      stiffness?: number;
      overshootClamping?: boolean;
    };
    from?: number;
    to?: number;
    durationInFrames?: number;
  }): number;

  export const Easing: {
    linear: (t: number) => number;
    quad: (t: number) => number;
    cubic: (t: number) => number;
    poly: (t: number) => number;
    sin: (t: number) => number;
    circle: (t: number) => number;
    exp: (t: number) => number;
    elastic: (t: number) => number;
    back: (t: number) => number;
    bounce: (t: number) => number;
    bezier: (x1: number, y1: number, x2: number, y2: number) => (t: number) => number;
    in: (easing: (t: number) => number) => (t: number) => number;
    out: (easing: (t: number) => number) => (t: number) => number;
    inOut: (easing: (t: number) => number) => (t: number) => number;
  };
}
