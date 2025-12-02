"use client";

import { ChangeEvent, useState } from "react";
import { useAppStore } from "../state/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Overlay
        </CardTitle>
        <CardDescription className="text-xs">Markdown text overlay.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Markdown
          </Label>
          <textarea
            id="markdown-textarea"
            value={markdown}
            onChange={handleTextChange}
            rows={4}
            className="min-h-[80px] resize-y rounded-lg border bg-background p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Write overlay copy in Markdown"
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-card">
          <Button
            variant="ghost"
            onClick={() => setIsTextSettingsOpen(!isTextSettingsOpen)}
            className="flex w-full items-center justify-between gap-2 rounded-lg p-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Text Settings
            <ChevronDown className={cn("h-4 w-4 transition-transform", isTextSettingsOpen && "rotate-180")} />
          </Button>
          {isTextSettingsOpen && (
            <div className="flex flex-col gap-2 px-2.5 pb-2.5">
              {/* Font size and max width sliders - keep existing for now */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 rounded-lg bg-muted p-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Font size
                  </span>
                  <input
                    type="range"
                    min={14}
                    max={64}
                    value={fontSizePx}
                    onChange={handleFontSize}
                  />
                  <span className="text-xs text-muted-foreground">{fontSizePx}px</span>
                </label>
                <label className="flex flex-col gap-1.5 rounded-lg bg-muted p-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Max width
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={maxWidthPct}
                    onChange={handleWidth}
                  />
                  <span className="text-xs text-muted-foreground">{maxWidthPct}% of stage</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 rounded-lg bg-muted p-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Text color
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={handleColor}
                      className="h-8 w-8 cursor-pointer rounded"
                    />
                    <Input
                      type="text"
                      value={color}
                      onChange={handleColor}
                      className="h-8 flex-1 text-xs"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5 rounded-lg bg-muted p-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Background
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={background ?? "#0f172a"}
                      onChange={handleBackground}
                      className="h-8 w-8 cursor-pointer rounded"
                    />
                    <Input
                      type="text"
                      value={background ?? ""}
                      onChange={handleBackground}
                      placeholder="rgba(...) or hex"
                      className="h-8 flex-1 text-xs"
                    />
                  </div>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">Leave blank for transparent.</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 rounded-lg bg-muted p-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Border width</span>
                  <input type="range" min={0} max={16} value={borderWidthPx} onChange={handleBorderWidth} />
                  <span className="text-xs text-muted-foreground">{borderWidthPx}px</span>
                </label>
                <label className="flex flex-col gap-1.5 rounded-lg bg-muted p-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Border radius</span>
                  <input type="range" min={0} max={48} value={borderRadiusPx} onChange={handleBorderRadius} />
                  <span className="text-xs text-muted-foreground">{borderRadiusPx}px</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 rounded-lg bg-muted p-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Border color</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={borderColor} onChange={handleBorderColor} className="h-8 w-8 cursor-pointer rounded" />
                    <Input
                      type="text"
                      value={borderColor}
                      onChange={handleBorderColor}
                      className="h-8 flex-1 text-xs"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5 rounded-lg bg-muted p-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Border style</span>
                  <select
                    value={borderStyle}
                    onChange={handleBorderStyle}
                    className="rounded-lg border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
            <Button
              key={value}
              variant={align === value ? "default" : "secondary"}
              onClick={() => setOverlayAlignment(value)}
              className="flex-1 text-xs uppercase tracking-wider"
            >
              {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
