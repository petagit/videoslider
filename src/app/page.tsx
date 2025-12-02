import { ExportPanel } from "../components/export-panel";
import { MediaPanel } from "../components/media-panel";
import { OverlayPanel } from "../components/overlay-panel";
import { PreviewStage } from "../components/preview-stage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export default function Home() {
  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal" autoSaveId="video-editor-main-layout">
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="bg-muted/10">
          <ScrollArea className="h-full">
            <div className="flex min-w-0 flex-col gap-6 p-4">
              <MediaPanel />
              <OverlayPanel />
              <ExportPanel />
            </div>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75}>
          <div className="flex h-full flex-col overflow-hidden bg-background">
            <PreviewStage />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
