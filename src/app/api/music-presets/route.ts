import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const MUSIC_PRESET_DIR = join(process.cwd(), "public", "slideshow-music-library");
const SUPPORTED_AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"]);

interface PresetDescriptor {
  id: string;
  name: string;
  filename: string;
  url: string;
}

export async function GET() {
  try {
    const entries = await readdir(MUSIC_PRESET_DIR, { withFileTypes: true });
    const presets: PresetDescriptor[] = entries
      .filter((entry) => entry.isFile())
      .filter((entry) => SUPPORTED_AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      .map((entry) => {
        const filename = entry.name;
        const extension = extname(filename);
        const name = basename(filename, extension);
        const encoded = encodeURIComponent(filename).replace(/%2F/g, "/");
        return {
          id: filename,
          name,
          filename,
          url: `/slideshow-music-library/${encoded}`,
        } satisfies PresetDescriptor;
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    return NextResponse.json({ presets });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ presets: [] });
    }

    console.error("Failed to read music presets", error);
    return NextResponse.json({ presets: [], error: "Unable to load music presets." }, { status: 500 });
  }
}
