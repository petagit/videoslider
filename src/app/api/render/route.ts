import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function saveBase64ToFile(base64Str: string, tmpDir: string, prefix: string): Promise<string> {
  // Check if it's a data URL
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    // Not a base64 data URL, return as is
    return base64Str;
  }

  const type = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  // Simple extension detection
  let ext = type.split('/')[1] || 'bin';
  if (ext === 'mpeg') ext = 'mp3';
  if (ext === 'svg+xml') ext = 'svg';
  
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = path.join(tmpDir, filename);
  
  await fs.writeFile(filePath, buffer);
  // Return absolute file URL
  return `file://${filePath}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { compositionId = "slider-reveal", ...payload } = body;

    const tmpDir: string = await fs.mkdtemp(path.join(os.tmpdir(), "slider-render-"));
    
    let audioDataUrl: string | null = null;

    // Handle audio
    if (payload.audioPreset) {
      // It's a local file in public/
      const presetPath = path.join(process.cwd(), "public", "slideshow-music-library", path.basename(payload.audioPreset));
      // Use absolute path
      audioDataUrl = `file://${presetPath}`;
    } else if (payload.audio) {
      // Could be base64 (uploaded) or remote URL
      if (payload.audio.startsWith('data:')) {
        audioDataUrl = await saveBase64ToFile(payload.audio, tmpDir, 'audio');
      } else if (/^https?:\/\//i.test(payload.audio)) {
        // Remote URL - download it
        try {
          const res = await fetch(payload.audio);
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mime = res.headers.get("content-type") ?? "audio/mpeg";
          let ext = "mp3";
          if (mime.includes("wav")) ext = "wav";
          
          const filename = `downloaded-audio.${ext}`;
          const filePath = path.join(tmpDir, filename);
          await fs.writeFile(filePath, buffer);
          audioDataUrl = `file://${filePath}`;
        } catch (e) {
            console.warn("Failed to download remote audio", e);
            audioDataUrl = null;
        }
      } else {
        // Unknown format or already a path?
        audioDataUrl = payload.audio;
      }
    }

    // Process Images - convert base64 to files
    if (payload.images && Array.isArray(payload.images)) {
      payload.images = await Promise.all(payload.images.map((img: string, i: number) => 
        saveBase64ToFile(img, tmpDir, `slide-${i}`)
      ));
    }

    if (payload.topImages && Array.isArray(payload.topImages)) {
        payload.topImages = await Promise.all(payload.topImages.map((img: string, i: number) => 
          saveBase64ToFile(img, tmpDir, `top-${i}`)
        ));
    }

    if (payload.bottomImages && Array.isArray(payload.bottomImages)) {
        payload.bottomImages = await Promise.all(payload.bottomImages.map((img: string, i: number) => 
          saveBase64ToFile(img, tmpDir, `bottom-${i}`)
        ));
    }

    const payloadPath: string = path.join(tmpDir, "payload.json");
    // We update the payload with the file:// URLs
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
          // The script prints the output path as the last line
          // It might also print Remotion logs, so we look for the path
          if (lastLine.startsWith("/") || lastLine.match(/^[a-zA-Z]:\\/)) { 
             resolve(lastLine);
          } else {
             // Fallback: try to find lines that look like paths or just check the known output location
             // scripts/render.js prints: process.stdout.write(outputLocation);
             // But Remotion might log stuff. render.js sets `quiet` or we capture stdout?
             // render.js sets quiet? No.
             // But we pipe stdout.
             // Let's assume the script output ends with the path.
             resolve(lastLine);
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

    // outputPath is in tmpDir
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
