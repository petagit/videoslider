/* eslint-disable @next/next/no-img-element */
"use client";

import { CSSProperties, useEffect, useMemo, useState, useRef } from "react";
import { motion, useMotionTemplate, useSpring, useTransform } from "motion/react";
import ReactMarkdown, { type Components as MarkdownComponents } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAppStore } from "../state/store";

export function PreviewStage() {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoPairs = useAppStore((state) => state.photoPairs);
  const activePairIndex = useAppStore((state) => state.activePairIndex);
  const compare = useAppStore((state) => state.compare);
  const overlay = useAppStore((state) => state.overlay);
  const setSliderPct = useAppStore((state) => state.setSliderPct);
  const setOverlayMarkdown = useAppStore((state) => state.setOverlayMarkdown);

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

  const handleDoubleClick = () => {
    setEditValue(overlay.markdown);
    setIsEditing(true);
  };

  const handleSave = () => {
    setOverlayMarkdown(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(overlay.markdown);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

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

  const components = useMemo<MarkdownComponents>(() => {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    return {
      h1: ({ node: _n, ref: _r, ...props }) => <h1 style={{ WebkitTextStroke: textStroke }} {...props} />,
      h2: ({ node: _n, ref: _r, ...props }) => <h2 style={{ WebkitTextStroke: textStroke }} {...props} />,
      h3: ({ node: _n, ref: _r, ...props }) => <h3 style={{ WebkitTextStroke: textStroke }} {...props} />,
      h4: ({ node: _n, ref: _r, ...props }) => <h4 style={{ WebkitTextStroke: textStroke }} {...props} />,
      p: ({ node: _n, ref: _r, ...props }) => <p style={{ WebkitTextStroke: textStroke }} {...props} />,
      ul: ({ node: _n, ref: _r, ...props }) => <ul style={{ WebkitTextStroke: textStroke }} {...props} />,
      ol: ({ node: _n, ref: _r, ...props }) => <ol style={{ WebkitTextStroke: textStroke }} {...props} />,
      a: ({ node: _n, ref: _r, ...props }) => <a style={{ WebkitTextStroke: textStroke }} {...props} />,
    };
    /* eslint-enable @typescript-eslint/no-unused-vars */
  }, [textStroke]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden bg-white p-4 transition-colors dark:bg-slate-900">
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Live Preview</h1>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {totalPairs > 0 ? `${Math.min(activePairIndex + 1, totalPairs)} / ${totalPairs}` : "—"}
          </span>
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2">
        <div
          id="preview-stage"
          className="relative w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_top,#e2e8f0_0%,#f8fafc_70%)] transition-colors dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_70%)]"
          style={{ aspectRatio: "9/16", maxHeight: "100%" }}
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

          <div className="absolute inset-0 flex items-center justify-center p-10">
            {isEditing ? (
              <div style={overlayStyles} className="markdown-preview w-full">
                <textarea
                  ref={textareaRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSave}
                  onKeyDown={handleKeyDown}
                  className="w-full resize-none rounded-lg border-2 border-sky-400 bg-white p-3 text-sm text-slate-700 shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-900 dark:text-slate-100"
                  style={{
                    fontSize: "14px",
                    fontFamily: overlay.fontFamily,
                    minHeight: "120px",
                    lineHeight: "1.5",
                  }}
                  placeholder="Edit markdown..."
                />
                <div className="mt-2 flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>Press Esc to cancel</span>
                  <span>•</span>
                  <span>Ctrl/Cmd + Enter to save</span>
                </div>
              </div>
            ) : (
              <div
                style={overlayStyles}
                className="markdown-preview cursor-pointer transition-opacity hover:opacity-90"
                onClick={() => {
                  const textarea = document.getElementById("markdown-textarea");
                  if (textarea) {
                    textarea.focus();
                    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                onDoubleClick={handleDoubleClick}
                onMouseDown={(e) => {
                  // Prevent slider interaction when clicking text
                  e.stopPropagation();
                }}
              >
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
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 transition-colors dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
            <span>Reveal</span>
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
        <div className="min-w-[100px] rounded-full border border-slate-200 bg-slate-200/80 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition-colors dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          {compare.orientation === "vertical" ? "↔" : "↕"}
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
