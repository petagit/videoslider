import React from "react";
import {
    AbsoluteFill,
    Img,
    Sequence,
    useVideoConfig,
    Audio,
    staticFile,
} from "remotion";

export interface SlideData {
    src: string;
    color?: string;
}

export interface SlideshowCompositionProps {
    images: SlideData[];
    durationPerSlide: number; // in seconds
    audio?: string;
    audioLoop?: boolean;
    audioDuration?: number;
    aspectRatio?: string;
}

export const SlideshowComposition: React.FC<SlideshowCompositionProps> = ({
    images,
    durationPerSlide,
    audio,
    audioLoop,
    audioDuration,
}) => {
    // console.log("[SlideshowComposition] Props:", { audio, audioLoop, audioDuration });
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
            {audio && typeof audio === "string" && (
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
                        <Sequence from={from} durationInFrames={slideDurationInFrames}>
                            {typeof shutterSound === "string" && <Audio src={shutterSound} />}
                        </Sequence>

                        <Sequence
                            from={from}
                            durationInFrames={slideDurationInFrames}
                        >
                            <Slide src={image.src} color={image.color} />
                        </Sequence>
                    </React.Fragment>
                );
            })}
        </AbsoluteFill>
    );
};


const Slide: React.FC<{
    src: string;
    color?: string;
}> = ({ src, color }) => {
    if (typeof src !== "string") {
        console.error("[Slide] Invalid src:", src);
        return (
            <AbsoluteFill style={{ backgroundColor: "red", justifyContent: "center", alignItems: "center" }}>
                Invalid Image Source
            </AbsoluteFill>
        );
    }
    return (
        <AbsoluteFill style={{ backgroundColor: color || "black" }}>
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
