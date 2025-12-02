import { ExportPanel } from "../components/export-panel";
import { MediaPanel } from "../components/media-panel";
import { OverlayPanel } from "../components/overlay-panel";
import { PreviewStage } from "../components/preview-stage";

export default function Home() {
  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[320px] shrink-0 flex-col gap-6 overflow-y-auto border-r bg-muted/30 p-6">
          <div className="flex flex-col gap-4">
            <MediaPanel />
            <OverlayPanel />
            <ExportPanel />
          </div>
        </aside>
        <main className="flex flex-1 flex-col overflow-hidden">
          <PreviewStage />
        </main>
      </div>
    </div>
  );
}
