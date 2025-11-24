import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

import type { SliderCompositionProps } from "../../../../remotion/SliderComposition";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_VIDEO_NAME = "slider-reveal-tiktok.mp4";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { compositionId = "slider-reveal", ...payload } = body;

    const tmpDir: string = await fs.mkdtemp(path.join(os.tmpdir(), "slider-render-"));
    
    let audioDataUrl: string | null = null;

    // Handle audio preset
    if (payload.audioPreset) {
      const presetPath = path.join(process.cwd(), "public", "slideshow-music-library", path.basename(payload.audioPreset));
      try {
        const audioBuffer = await fs.readFile(presetPath);
        // Guess mime type based on extension or default to mp3
        const ext = path.extname(presetPath).toLowerCase();
        const mime = ext === ".wav" ? "audio/wav" : "audio/mpeg";
        audioDataUrl = `data:${mime};base64,${audioBuffer.toString("base64")}`;
      } catch (e) {
        console.warn(`Failed to load audio preset: ${payload.audioPreset}`, e);
      }
    } else {
      // If audio is a remote URL, fetch it and convert to data URL
      audioDataUrl = payload.audio ?? null;
      if (audioDataUrl && /^https?:\/\//i.test(audioDataUrl)) {
        try {
          const res = await fetch(audioDataUrl);
          const buf = Buffer.from(await res.arrayBuffer());
          const mime = res.headers.get("content-type") ?? "audio/mpeg";
          audioDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
        } catch {
          audioDataUrl = null;
        }
      }
    }

    const payloadPath: string = path.join(tmpDir, "payload.json");
    await fs.writeFile(payloadPath, JSON.stringify({ ...payload, audio: audioDataUrl }), "utf-8");

    const scriptPath: string = path.join(process.cwd(), "scripts", "render.js");
    const videoFileName = `render-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.mp4`;

    const outputPath: string = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath, payloadPath, videoFileName, compositionId], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      child.on("close", (code: number) => {
        if (code === 0) {
          const lastLine = stdout.trim().split("\n").pop() ?? "";
          if (lastLine.startsWith("/")) {
            resolve(lastLine);
          } else {
            reject(new Error(`Unexpected child output: ${lastLine}`));
          }
        } else {
          reject(new Error(`Render process exited with code ${code}: ${stderr}`));
        }
      });
      child.on("error", (err: Error) => reject(err));
    });

    // Move the rendered file to public/renders
    const publicRendersDir = path.join(process.cwd(), "public", "renders");
    await fs.mkdir(publicRendersDir, { recursive: true });
    const publicFilePath = path.join(publicRendersDir, videoFileName);

    await fs.copyFile(outputPath, publicFilePath);
    await fs.rm(tmpDir, { recursive: true, force: true });

    const publicUrl = `/renders/${videoFileName}`;

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("Remotion render failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
