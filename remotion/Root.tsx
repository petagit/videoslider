import { Composition } from "remotion";
import { SliderComposition, type SliderCompositionProps } from "./SliderComposition";
import { SlideshowComposition, type SlideshowCompositionProps } from "./SlideshowComposition";

const defaultOverlay: SliderCompositionProps["overlay"] = {
  markdown: "## Overlay headline\nExplain your comparison with Markdown.",
  fontFamily: "'Geist', 'Geist Variable', 'Helvetica Neue', Arial, sans-serif",
  fontSizePx: 64,
  color: "#ffffff",
  background: null,
  maxWidthPct: 60,
  align: "center",
  borderColor: "#000000",
  borderWidthPx: 2,
  borderStyle: "solid",
  borderRadiusPx: 24,
};

const defaultAnimation: SliderCompositionProps["animation"] = {
  durationMs: 11000,
  frameRate: 30,
  easing: "easeInOut",
  direction: "forward",
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition<SliderCompositionProps>
      id="slider-reveal"
      component={SliderComposition}
      // TikTok 9:16 portrait, safe zone 1080x1920
      durationInFrames={Math.round((defaultAnimation.durationMs / 1000) * defaultAnimation.frameRate)}
      fps={defaultAnimation.frameRate}
      width={1080}
      height={1920}
      defaultProps={{
        topImages: [""],
        bottomImages: [""],
        compare: { orientation: "vertical", showDivider: true },
        overlay: defaultOverlay,
        animation: defaultAnimation,
      }}
    />
    <Composition<SlideshowCompositionProps>
      id="slideshow"
      component={SlideshowComposition}
      durationInFrames={30 * 5} // Default placeholder duration
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        images: [],
        durationPerSlide: 1.5,
      }}
      calculateMetadata={({ props }: { props: SlideshowCompositionProps }) => {
        const fps = 30;
        const durationPerSlide = props.durationPerSlide ?? 1.5;
        const count = props.images?.length ?? 0;

        const durationInFrames = Math.round(count * durationPerSlide * fps);

        const isLandscape = props.aspectRatio === "16:9";
        const width = isLandscape ? 1920 : 1080;
        const height = isLandscape ? 1080 : 1920;

        return {
          durationInFrames: count === 0 ? 30 : durationInFrames,
          fps,
          width,
          height,
        };
      }}
    />
  </>
);
