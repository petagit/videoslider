"use client";

import { ChangeEvent, useState } from "react";
import { useAppStore } from "../state/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ChevronDown, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Overlay
        </CardTitle>
        <CardDescription className="text-xs">Markdown text overlay.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
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
            <div className="flex flex-col gap-4 px-3 pb-4">
              {/* Font size and max width sliders */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Font size
                    </span>
                    <span className="text-xs text-muted-foreground">{fontSizePx}px</span>
                  </div>
                  <Slider
                    min={14}
                    max={64}
                    step={1}
                    value={[fontSizePx]}
                    onValueChange={([val]) => setOverlayFontSize(val)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Max width
                    </span>
                    <span className="text-xs text-muted-foreground">{maxWidthPct}%</span>
                  </div>
                  <Slider
                    min={20}
                    max={100}
                    step={1}
                    value={[maxWidthPct]}
                    onValueChange={([val]) => setOverlayMaxWidth(val)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Text color
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8 overflow-hidden rounded-md border shadow-sm">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setOverlayColor(e.target.value)}
                        className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer p-0"
                      />
                    </div>
                    <Input
                      type="text"
                      value={color}
                      onChange={(e) => setOverlayColor(e.target.value)}
                      className="h-8 flex-1 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Background
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8 overflow-hidden rounded-md border shadow-sm">
                      <input
                        type="color"
                        value={background ?? "#0f172a"}
                        onChange={(e) => setOverlayBackground(e.target.value)}
                        className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer p-0"
                      />
                    </div>
                    <Input
                      type="text"
                      value={background ?? ""}
                      onChange={(e) => setOverlayBackground(e.target.value === "" ? undefined : e.target.value)}
                      placeholder="None"
                      className="h-8 flex-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Border width</span>
                    <span className="text-xs text-muted-foreground">{borderWidthPx}px</span>
                  </div>
                  <Slider
                    min={0}
                    max={16}
                    step={1}
                    value={[borderWidthPx]}
                    onValueChange={([val]) => setOverlayBorder({ borderWidthPx: val })}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Radius</span>
                    <span className="text-xs text-muted-foreground">{borderRadiusPx}px</span>
                  </div>
                  <Slider
                    min={0}
                    max={48}
                    step={1}
                    value={[borderRadiusPx]}
                    onValueChange={([val]) => setOverlayBorder({ borderRadiusPx: val })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Border color</span>
                  <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8 overflow-hidden rounded-md border shadow-sm">
                      <input
                        type="color"
                        value={borderColor}
                        onChange={(e) => setOverlayBorder({ borderColor: e.target.value })}
                        className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer p-0"
                      />
                    </div>
                    <Input
                      type="text"
                      value={borderColor}
                      onChange={(e) => setOverlayBorder({ borderColor: e.target.value })}
                      className="h-8 flex-1 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Border style</span>
                  <Select
                    value={borderStyle}
                    onValueChange={(val) => setOverlayBorder({ borderStyle: val as typeof borderStyle })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="dashed">Dashed</SelectItem>
                      <SelectItem value="dotted">Dotted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex w-full items-center rounded-lg border bg-muted/50 p-1">
            {([
              ["left", AlignLeft],
              ["center", AlignCenter],
              ["right", AlignRight],
            ] as const).map(([value, Icon]) => (
              <Button
                key={value}
                variant={align === value ? "default" : "ghost"}
                size="sm"
                onClick={() => setOverlayAlignment(value)}
                className="flex-1 h-7"
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
