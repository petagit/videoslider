import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface SliderCompositionProps extends Record<string, unknown> {
  topImages: string[];
  bottomImages: string[];
  audio?: string | null;
  audioLoop?: boolean;
  audioDuration?: number;
  compare: {
    orientation: "vertical" | "horizontal";
    showDivider: boolean;
  };
  overlay: {
    markdown: string;
    fontFamily: string;
    fontSizePx: number;
    color: string;
    background: string | null;
    maxWidthPct: number;
    align: "left" | "center" | "right";
    borderColor?: string;
    borderWidthPx?: number;
    borderStyle?: "none" | "solid" | "dashed" | "dotted";
    borderRadiusPx?: number;
  };
  animation: {
    durationMs: number;
    frameRate: number;
    easing: "linear" | "easeIn" | "easeOut" | "easeInOut";
    direction: "forward" | "reverse" | "pingpong";
  };
}

const easingMap: Record<SliderCompositionProps["animation"]["easing"], (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => Easing.in(Easing.cubic)(t),
  easeOut: (t) => Easing.out(Easing.cubic)(t),
  easeInOut: (t) => Easing.inOut(Easing.cubic)(t),
};

const directionMap = (
  direction: SliderCompositionProps["animation"]["direction"],
  value: number,
): number => {
  switch (direction) {
    case "forward":
      return value;
    case "reverse":
      return 1 - value;
    case "pingpong":
      return value <= 0.5 ? value * 2 : 2 - value * 2;
    default:
      return value;
  }
};

const overlayStyle = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    lineHeight: 1.5,
    margin: 0,
  } satisfies React.CSSProperties,
  heading: (stroke?: string) => ({
    fontWeight: 700,
    letterSpacing: "-0.01em",
    margin: 0,
    WebkitTextStroke: stroke,
  } satisfies React.CSSProperties),
  paragraph: (stroke?: string) => ({
    margin: 0,
    WebkitTextStroke: stroke,
  } satisfies React.CSSProperties),
  list: (stroke?: string) => ({
    margin: 0,
    paddingLeft: "1.25em",
    WebkitTextStroke: stroke,
  } satisfies React.CSSProperties),
  link: (stroke?: string) => ({
    color: "#38bdf8",
    textDecoration: "underline",
    WebkitTextStroke: stroke,
  } satisfies React.CSSProperties),
};

export const SliderComposition: React.FC<SliderCompositionProps> = ({
  topImages,
  bottomImages,
  audio,
  compare,
  overlay,
  animation,
  audioLoop,
  audioDuration,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const framesPerSegment = Math.max(1, Math.round((animation.durationMs / 1000) * animation.frameRate));
  const pairCount = Math.min(topImages.length, bottomImages.length);
  const fallbackCount = Math.max(pairCount, 1);
  const currentSegment = Math.min(fallbackCount - 1, Math.floor(frame / framesPerSegment));
  const frameWithinSegment = Math.min(
    Math.max(frame - currentSegment * framesPerSegment, 0),
    framesPerSegment - 1,
  );

  const easedProgress = framesPerSegment <= 1
    ? 1
    : interpolate(frameWithinSegment, [0, framesPerSegment - 1], [0, 1], {
      easing: easingMap[animation.easing],
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const progress = directionMap(animation.direction, easedProgress);
  const percentage = progress * 100;

  const currentTopImage = topImages[currentSegment] ?? topImages[topImages.length - 1] ?? "";
  const currentBottomImage = bottomImages[currentSegment] ?? bottomImages[bottomImages.length - 1] ?? "";

  const clipPath = compare.orientation === "vertical"
    ? `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`
    : `polygon(0 0, 100% 0, 100% ${percentage}%, 0 ${percentage}%)`;

  const dividerStyle = (() => {
    if (!compare.showDivider) {
      return undefined;
    }

    if (compare.orientation === "vertical") {
      return {
        left: `${percentage}%`,
        top: 0,
        bottom: 0,
        width: 4,
      } satisfies React.CSSProperties;
    }

    return {
      top: `${percentage}%`,
      left: 0,
      right: 0,
      height: 4,
    } satisfies React.CSSProperties;
  })();

  const overlayBoxStyle: React.CSSProperties = {
    maxWidth: `${overlay.maxWidthPct}%`,
    fontSize: `${overlay.fontSizePx}px`,
    fontFamily: overlay.fontFamily,
    fontWeight: 700,
    color: overlay.color,
    backgroundColor: overlay.background ?? "transparent",
    padding: overlay.background ? "32px" : "0",
    borderRadius: `${overlay.borderRadiusPx ?? 0}px`,
    textAlign: overlay.align,
    marginLeft: overlay.align === "left" ? 0 : overlay.align === "center" ? "auto" : "auto",
    marginRight: overlay.align === "right" ? 0 : overlay.align === "center" ? "auto" : "auto",
  };

  const textStroke = overlay.borderStyle && overlay.borderStyle !== "none" && (overlay.borderWidthPx ?? 0) > 0
    ? `${overlay.borderWidthPx}px ${overlay.borderColor ?? "#000"}`
    : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: "#020617" }}>
      {audio ? (
        audioLoop && audioDuration ? (
          // Loop audio
          Array.from({ length: Math.ceil(durationInFrames / (audioDuration * 30)) }).map((_, i) => (
            <Sequence
              key={`audio-loop-${i}`}
              from={Math.round(i * audioDuration * 30)}
              durationInFrames={Math.round(audioDuration * 30)}
            >
              <Audio
                src={audio}
                volume={1}
              // No trim needed if we loop the whole file
              />
            </Sequence>
          ))
        ) : (
          // Single play
          <Audio
            src={audio}
            trimBefore={0}
            trimAfter={durationInFrames}
            volume={1}
            useWebAudioApi
          />
        )
      ) : null}
      <AbsoluteFill style={{ transform: "scale(1.02)" }}>
        {currentBottomImage ? (
          <Img
            key={`bottom-${currentSegment}`}
            src={currentBottomImage}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <AbsoluteFill style={{ background: "linear-gradient(135deg,#1f2937,#0f172a)" }} />
        )}
      </AbsoluteFill>

      <AbsoluteFill style={{ clipPath, transform: "scale(1.02)" }}>
        {currentTopImage ? (
          <Img
            key={`top-${currentSegment}`}
            src={currentTopImage}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <AbsoluteFill style={{ background: "linear-gradient(135deg,#312e81,#0f172a)" }} />
        )}
      </AbsoluteFill>

      {dividerStyle ? (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            ...dividerStyle,
            backgroundColor: "transparent",
            transform: compare.orientation === "vertical" ? "translateX(-2px)" : "translateY(-2px)",
          }}
        />
      ) : null}

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: `${Math.round(height * 0.08)}px ${Math.round(width * 0.06)}px`,
          pointerEvents: "none",
        }}
      >
        <div style={overlayBoxStyle}>
          {overlay.markdown.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: (props) => <h1 style={overlayStyle.heading(textStroke)} {...props} />,
                h2: (props) => <h2 style={overlayStyle.heading(textStroke)} {...props} />,
                h3: (props) => <h3 style={overlayStyle.heading(textStroke)} {...props} />,
                h4: (props) => <h4 style={overlayStyle.heading(textStroke)} {...props} />,
                p: (props) => <p style={overlayStyle.paragraph(textStroke)} {...props} />,
                ul: (props) => <ul style={overlayStyle.list(textStroke)} {...props} />,
                ol: (props) => <ol style={overlayStyle.list(textStroke)} {...props} />,
                a: (props) => <a style={overlayStyle.link(textStroke)} {...props} />,
              }}
            >
              {overlay.markdown}
            </ReactMarkdown>
          ) : (
            <p style={{ ...overlayStyle.paragraph, color: "#cbd5f5" }}>
              Add Markdown in the editor to see it here.
            </p>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
