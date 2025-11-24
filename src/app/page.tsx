import Link from "next/link";
import { ExportPanel } from "../components/export-panel";
import { MediaPanel } from "../components/media-panel";
import { OverlayPanel } from "../components/overlay-panel";
import { PreviewStage } from "../components/preview-stage";

export default function Home() {
  return (
    <div className="flex h-full overflow-hidden text-slate-900 dark:text-slate-100">
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 md:w-[280px] lg:w-[380px]">
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
