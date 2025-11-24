"use client";

import { ChangeEvent, useState } from "react";
import { useAppStore } from "../state/store";

export function OverlayPanel() {
  const [isTextSettingsOpen, setIsTextSettingsOpen] = useState<boolean>(true);
  const markdown = useAppStore((state) => state.overlay.markdown);
  const fontSizePx = useAppStore((state) => state.overlay.fontSizePx);
  const color = useAppStore((state) => state.overlay.color);
  const maxWidthPct = useAppStore((state) => state.overlay.maxWidthPct);
  const align = useAppStore((state) => state.overlay.align);
  const background = useAppStore((state) => state.overlay.background);
  const borderColor = useAppStore((state) => state.overlay.borderColor);
  const borderWidthPx = useAppStore((state) => state.overlay.borderWidthPx);
  const borderStyle = useAppStore((state) => state.overlay.borderStyle);
  const borderRadiusPx = useAppStore((state) => state.overlay.borderRadiusPx);
  const setOverlayMarkdown = useAppStore((state) => state.setOverlayMarkdown);
  const setOverlayFontSize = useAppStore((state) => state.setOverlayFontSize);
  const setOverlayColor = useAppStore((state) => state.setOverlayColor);
  const setOverlayMaxWidth = useAppStore((state) => state.setOverlayMaxWidth);
  const setOverlayAlignment = useAppStore((state) => state.setOverlayAlignment);
  const setOverlayBackground = useAppStore((state) => state.setOverlayBackground);
  const setOverlayBorder = useAppStore((state) => state.setOverlayBorder);

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setOverlayMarkdown(event.target.value);
  };

  const handleFontSize = (event: ChangeEvent<HTMLInputElement>) => {
    setOverlayFontSize(Number(event.target.value));
  };

  const handleWidth = (event: ChangeEvent<HTMLInputElement>) => {
    setOverlayMaxWidth(Number(event.target.value));
  };

  const handleColor = (event: ChangeEvent<HTMLInputElement>) => {
    setOverlayColor(event.target.value);
  };

  const handleBackground = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setOverlayBackground(value === "" ? undefined : value);
  };

  const handleBorderColor = (event: ChangeEvent<HTMLInputElement>) => {
    setOverlayBorder({ borderColor: event.target.value });
  };
  const handleBorderWidth = (event: ChangeEvent<HTMLInputElement>) => {
    setOverlayBorder({ borderWidthPx: Number(event.target.value) });
  };
  const handleBorderRadius = (event: ChangeEvent<HTMLInputElement>) => {
    setOverlayBorder({ borderRadiusPx: Number(event.target.value) });
  };
  const handleBorderStyle = (event: ChangeEvent<HTMLSelectElement>) => {
    setOverlayBorder({ borderStyle: event.target.value as typeof borderStyle });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/60">
      <header className="mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800 dark:text-slate-300">
          Overlay
        </h2>
        <p className="text-[11px] text-slate-600 dark:text-slate-400">Markdown text overlay.</p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-600 dark:text-slate-400">
            Markdown
          </label>
          <textarea
            id="markdown-textarea"
            value={markdown}
            onChange={handleTextChange}
            rows={4}
            className="min-h-[80px] resize-y rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="Write overlay copy in Markdown"
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={() => setIsTextSettingsOpen(!isTextSettingsOpen)}
            className="flex items-center justify-between gap-2 rounded-lg p-2.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-900/60"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
              Text Settings
            </span>
            <svg
              className={`h-4 w-4 text-slate-500 transition-transform dark:text-slate-400 ${
                isTextSettingsOpen ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isTextSettingsOpen && (
            <div className="flex flex-col gap-2 px-2.5 pb-2.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 rounded-lg bg-slate-100 p-2.5 transition-colors dark:bg-slate-950/40">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
                    Font size
                  </span>
                  <input
                    type="range"
                    min={14}
                    max={64}
                    value={fontSizePx}
                    onChange={handleFontSize}
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-300">{fontSizePx}px</span>
                </label>
                <label className="flex flex-col gap-1.5 rounded-lg bg-slate-100 p-2.5 transition-colors dark:bg-slate-950/40">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
                    Max width
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={maxWidthPct}
                    onChange={handleWidth}
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-300">{maxWidthPct}% of stage</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 rounded-lg bg-slate-100 p-2.5 transition-colors dark:bg-slate-950/40">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
                    Text color
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={handleColor}
                      className="h-8 w-8 cursor-pointer rounded"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={handleColor}
                      className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5 rounded-lg bg-slate-100 p-2.5 transition-colors dark:bg-slate-950/40">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">
                    Background
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={background ?? "#0f172a"}
                      onChange={handleBackground}
                      className="h-8 w-8 cursor-pointer rounded"
                    />
                    <input
                      type="text"
                      value={background ?? ""}
                      onChange={handleBackground}
                      placeholder="rgba(...) or hex"
                      className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <span className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">Leave blank for transparent.</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 rounded-lg bg-slate-100 p-2.5 transition-colors dark:bg-slate-950/40">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">Border width</span>
                  <input type="range" min={0} max={16} value={borderWidthPx} onChange={handleBorderWidth} />
                  <span className="text-xs text-slate-600 dark:text-slate-300">{borderWidthPx}px</span>
                </label>
                <label className="flex flex-col gap-1.5 rounded-lg bg-slate-100 p-2.5 transition-colors dark:bg-slate-950/40">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">Border radius</span>
                  <input type="range" min={0} max={48} value={borderRadiusPx} onChange={handleBorderRadius} />
                  <span className="text-xs text-slate-600 dark:text-slate-300">{borderRadiusPx}px</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 rounded-lg bg-slate-100 p-2.5 transition-colors dark:bg-slate-950/40">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">Border color</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={borderColor} onChange={handleBorderColor} className="h-8 w-8 cursor-pointer rounded" />
                    <input
                      type="text"
                      value={borderColor}
                      onChange={handleBorderColor}
                      className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5 rounded-lg bg-slate-100 p-2.5 transition-colors dark:bg-slate-950/40">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-slate-400">Border style</span>
                  <select
                    value={borderStyle}
                    onChange={handleBorderStyle}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  >
                    <option value="none">None</option>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {([
            ["left", "Left"],
            ["center", "Center"],
            ["right", "Right"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setOverlayAlignment(value)}
              className={`flex-1 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] transition ${
                align === value
                  ? "bg-sky-500/25 text-sky-700 dark:bg-sky-500/30 dark:text-sky-100"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-950/40 dark:text-slate-400 dark:hover:bg-slate-900/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
