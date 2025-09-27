/* eslint-disable @next/next/no-img-element */
"use client";

import { CSSProperties, useEffect, useMemo } from "react";
import { motion, useMotionTemplate, useSpring, useTransform } from "motion/react";
import ReactMarkdown, { type Components as MarkdownComponents } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAppStore } from "../state/store";

export function PreviewStage() {
  const photoPairs = useAppStore((state) => state.photoPairs);
  const activePairIndex = useAppStore((state) => state.activePairIndex);
  const compare = useAppStore((state) => state.compare);
  const overlay = useAppStore((state) => state.overlay);
  const setSliderPct = useAppStore((state) => state.setSliderPct);

  const activePair = photoPairs[activePairIndex] ?? photoPairs[0];
  const topImage = activePair?.top;
  const bottomImage = activePair?.bottom;
  const totalPairs = photoPairs.length;
  const displayPairNumber = totalPairs > 0 ? Math.min(activePairIndex + 1, totalPairs) : 1;

  const sliderSpring = useSpring(compare.sliderPct, { stiffness: 90, damping: 18, mass: 0.8 });

  useEffect(() => {
    sliderSpring.set(compare.sliderPct);
  }, [compare.sliderPct, sliderSpring]);

  const verticalClip = useMotionTemplate`polygon(0 0, ${sliderSpring}% 0, ${sliderSpring}% 100%, 0 100%)`;
  const horizontalClip = useMotionTemplate`polygon(0 0, 100% 0, 100% ${sliderSpring}%, 0 ${sliderSpring}%)`;
  const clipPath = compare.orientation === "vertical" ? verticalClip : horizontalClip;

  const clipPathFallback = useMemo(() => {
    if (compare.orientation === "vertical") {
      return `polygon(0 0, ${compare.sliderPct}% 0, ${compare.sliderPct}% 100%, 0 100%)`;
    }

    return `polygon(0 0, 100% 0, 100% ${compare.sliderPct}%, 0 ${compare.sliderPct}%)`;
  }, [compare.orientation, compare.sliderPct]);

  const dividerPosition = useTransform(sliderSpring, (value) => `${value}%`);

  const overlayStyles = useMemo<CSSProperties>(() => {
    const base: CSSProperties = {
      maxWidth: `${overlay.maxWidthPct}%`,
      fontSize: `${overlay.fontSizePx}px`,
      fontFamily: overlay.fontFamily,
      fontWeight: 700,
      color: overlay.color,
      backgroundColor: overlay.background ?? "transparent",
      padding: overlay.background ? "1rem" : "0",
      borderRadius: `${overlay.borderRadiusPx}px`,
    };

    if (overlay.align === "center") {
      base.marginLeft = "auto";
      base.marginRight = "auto";
      base.textAlign = "center";
    } else if (overlay.align === "right") {
      base.marginLeft = "auto";
      base.marginRight = "0";
      base.textAlign = "right";
    } else {
      base.marginLeft = "0";
      base.marginRight = "auto";
      base.textAlign = "left";
    }

    return base;
  }, [
    overlay.align,
    overlay.background,
    overlay.borderRadiusPx,
    overlay.color,
    overlay.fontFamily,
    overlay.fontSizePx,
    overlay.maxWidthPct,
  ]);

  const textStroke = useMemo(() => {
    if (overlay.borderStyle === "none" || overlay.borderWidthPx === 0) return undefined;
    return `${overlay.borderWidthPx}px ${overlay.borderColor}`;
  }, [overlay.borderColor, overlay.borderStyle, overlay.borderWidthPx]);

  const components = useMemo<MarkdownComponents>(() => ({
    h1: ({ node: _n, ref: _r, ...props }) => <h1 style={{ WebkitTextStroke: textStroke }} {...props} />,
    h2: ({ node: _n, ref: _r, ...props }) => <h2 style={{ WebkitTextStroke: textStroke }} {...props} />,
    h3: ({ node: _n, ref: _r, ...props }) => <h3 style={{ WebkitTextStroke: textStroke }} {...props} />,
    h4: ({ node: _n, ref: _r, ...props }) => <h4 style={{ WebkitTextStroke: textStroke }} {...props} />,
    p: ({ node: _n, ref: _r, ...props }) => <p style={{ WebkitTextStroke: textStroke }} {...props} />,
    ul: ({ node: _n, ref: _r, ...props }) => <ul style={{ WebkitTextStroke: textStroke }} {...props} />,
    ol: ({ node: _n, ref: _r, ...props }) => <ol style={{ WebkitTextStroke: textStroke }} {...props} />,
    a: ({ node: _n, ref: _r, ...props }) => <a style={{ WebkitTextStroke: textStroke }} {...props} />,
  }), [textStroke]);

  return (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.25)] transition-colors dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-[0_30px_80px_-40px_rgba(15,23,42,0.8)]">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
          Live Preview
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Slider reveal prototype
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Drag the slider to test the mask. Drop your own images on the left to see this stage
          update instantly.
        </p>
        <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
          <span>Active pair</span>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {totalPairs > 0 ? `${Math.min(activePairIndex + 1, totalPairs)} / ${totalPairs}` : "—"}
          </span>
        </div>
      </header>

      <div className="relative w-full flex-1">
        <div
          id="preview-stage"
          className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top,#e2e8f0_0%,#f8fafc_70%)] transition-colors dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_70%)]"
        >
          {bottomImage ? (
            <img
              key={bottomImage.id}
              src={bottomImage.src}
              alt={bottomImage.alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Placeholder label={`Bottom photo ${displayPairNumber}`} position="bottom" />
          )}

          {topImage ? (
            <motion.img
              key={topImage.id}
              src={topImage.src}
              alt={topImage.alt}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath }}
            />
          ) : (
            <Placeholder label={`Top photo ${displayPairNumber}`} position="top" clipPath={clipPathFallback} />
          )}

          <motion.div
            className="pointer-events-none absolute bg-transparent"
            style={
              compare.showDivider
                ? compare.orientation === "vertical"
                  ? { left: dividerPosition, top: 0, bottom: 0, width: "2px" }
                  : { top: dividerPosition, left: 0, right: 0, height: "2px" }
                : { display: "none" }
            }
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
            <div style={overlayStyles} className="markdown-preview">
              {overlay.markdown.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                  {overlay.markdown}
                </ReactMarkdown>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Start typing Markdown in the overlay panel to see it land here.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-100/80 px-6 py-4 transition-colors dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
            <span>Reveal percentage</span>
            <span className="text-sky-600 dark:text-sky-200">{compare.sliderPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={compare.sliderPct}
            onChange={(event) => setSliderPct(Number(event.target.value))}
            className="accent-sky-500"
          />
        </div>
        <div className="min-w-[120px] rounded-full border border-slate-200 bg-slate-200/80 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition-colors dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          {compare.orientation === "vertical" ? "Left ↔ Right" : "Top ↕ Bottom"}
        </div>
      </div>
    </div>
  );
}

interface PlaceholderProps {
  label: string;
  position: "top" | "bottom";
  clipPath?: string;
}

function Placeholder({ label, position, clipPath }: PlaceholderProps) {
  return (
    <div
      className={`absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500 transition-colors dark:text-slate-300 ${
        position === "top"
          ? "bg-[radial-gradient(circle_at_top_left,#dbeafe,#f8fafc)] dark:bg-[radial-gradient(circle_at_top_left,#0f172a,#020617)]"
          : "bg-[radial-gradient(circle_at_bottom_right,#fce7f3,#f8fafc)] dark:bg-[radial-gradient(circle_at_bottom_right,#1e1b4b,#020617)]"
      }`}
      style={position === "top" ? { clipPath } : undefined}
    >
      <svg
        aria-hidden
        viewBox="0 0 48 48"
        className="h-10 w-10 text-slate-400 dark:text-slate-700"
      >
        <path
          fill="currentColor"
          d="M8 10a2 2 0 0 1 2-2h28a2 2 0 0 1 2 2v20H8zm0 20v8a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2v-8l-6-6-7 7-9-9z"
        />
      </svg>
      <p className="text-xs font-semibold uppercase tracking-[0.3em]">{label}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Drop an image to replace this placeholder.</p>
    </div>
  );
}
