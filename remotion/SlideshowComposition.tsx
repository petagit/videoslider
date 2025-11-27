import React, { useEffect, useState } from "react";
import {
    AbsoluteFill,
    Img,
    Sequence,
    useVideoConfig,
    delayRender,
    continueRender,
    Audio,
    staticFile,
} from "remotion";

export interface SlideshowCompositionProps {
    images: string[];
    durationPerSlide: number; // in seconds
    audio?: string;
    audioLoop?: boolean;
    audioDuration?: number;
}

export const SlideshowComposition: React.FC<SlideshowCompositionProps> = ({
    images,
    durationPerSlide,
    audio,
    audioLoop,
    audioDuration,
}) => {
    console.log("[SlideshowComposition] Props:", { audio, audioLoop, audioDuration });
    const { fps } = useVideoConfig();

    if (!images || images.length === 0) {
        return (
            <AbsoluteFill
                style={{
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "black",
                    color: "white",
                    fontSize: 40,
                }}
            >
                No images provided
            </AbsoluteFill>
        );
    }

    const slideDurationInFrames = Math.round(durationPerSlide * fps);
    const totalDurationInFrames = slideDurationInFrames * images.length;
    // Use the local file as the shutter sound effect
    const shutterSound = staticFile("/fnv-slideshow.mp3");

    return (
        <AbsoluteFill style={{ backgroundColor: "black" }}>
            {audio && (
                audioLoop && audioDuration ? (
                    // Loop audio
                    Array.from({ length: Math.ceil(totalDurationInFrames / (audioDuration * fps)) }).map((_, i) => (
                        <Sequence
                            key={`audio-loop-${i}`}
                            from={Math.round(i * audioDuration * fps)}
                            durationInFrames={Math.round(audioDuration * fps)}
                        >
                            <Audio src={audio} />
                        </Sequence>
                    ))
                ) : (
                    <Audio src={audio} />
                )
            )}
            {images.map((image, index) => {
                const from = index * slideDurationInFrames;
                return (
                    <React.Fragment key={index}>
                        {/* Play shutter sound at the start of each slide transition (except maybe the first one if desired, but here we play for all) */}
                        <Sequence from={from} durationInFrames={slideDurationInFrames}>
                            <Audio src={shutterSound} />
                        </Sequence>

                        <Sequence
                            from={from}
                            durationInFrames={slideDurationInFrames}
                        >
                            <Slide src={image} />
                        </Sequence>
                    </React.Fragment>
                );
            })}
        </AbsoluteFill>
    );
};


const Slide: React.FC<{
    src: string;
}> = ({ src }) => {
    const [backgroundColor, setBackgroundColor] = useState("black");
    const [handle] = useState(() => delayRender("extract-color"));

    useEffect(() => {
        let mounted = true;
        let timeoutId: NodeJS.Timeout;

        const getColor = async () => {
            try {
                const img = new Image();
                // Only set crossOrigin for remote URLs (http/https)
                // Local file:// or blob: URLs might fail with it
                if (src.startsWith("http") || src.startsWith("//")) {
                    img.crossOrigin = "Anonymous";
                }
                img.src = src;

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = (e) => reject(new Error(`Failed to load image`));
                });

                if (!mounted) return;

                const canvas = document.createElement("canvas");
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, 1, 1);
                    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                    setBackgroundColor(`rgb(${r}, ${g}, ${b})`);
                }
            } catch (e) {
                console.warn("Failed to extract color for slide, defaulting to black", e);
            } finally {
                if (mounted) continueRender(handle);
            }
        };

        // Safety timeout: if image loading hangs for > 5s, proceed anyway
        timeoutId = setTimeout(() => {
            if (mounted) {
                console.warn("Image color extraction timed out, continuing render");
                continueRender(handle);
            }
        }, 5000);

        getColor();

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
        };
    }, [handle, src]);

    return (
        <AbsoluteFill style={{ backgroundColor }}>
            <Img
                src={src}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                }}
            />
        </AbsoluteFill>
    );
};
