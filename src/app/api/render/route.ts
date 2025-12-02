import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import os from "node:os";
import fs, { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { renderMediaOnLambda } from "@remotion/lambda/client";
import { uploadBase64ToS3 } from "@/lib/s3-upload";
import { AwsRegion } from "@remotion/lambda";

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

async function resolveAsset(
  asset: string,
  tmpDir: string,
  prefix: string,
  useLambda: boolean
): Promise<string> {
  if (!asset) return asset;

  if (useLambda) {
    // If base64, upload to S3
    if (asset.startsWith("data:")) {
      const matches = asset.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const type = matches?.[1] ?? "image/png";
      let ext = type.split('/')[1] || 'bin';
      if (ext === 'mpeg') ext = 'mp3';
      if (ext === 'svg+xml') ext = 'svg';

      const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      return await uploadBase64ToS3(asset, filename);
    }
    // If it's a local file (audioPreset), we need to upload it to S3 too
    // BUT, the client sends "audioPreset" which is a filename.
    // We need to read it and upload.
    // We'll handle audioPreset separately in the main flow.
    return asset;
  } else {
    return saveBase64ToFile(asset, tmpDir, prefix);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { compositionId = "slider-reveal", renderMode, ...payload } = body;
    console.log("[API] Render Request:", {
      compositionId,
      renderMode,
      audioLoop: payload.audioLoop,
      audioDuration: payload.audioDuration
    });

    // Determine render mode: 'lambda', 'local', or auto-detect
    const useLambda = renderMode === 'lambda'
      ? true
      : renderMode === 'local'
        ? false
        : !!process.env.REMOTION_LAMBDA_FUNCTION_NAME;

    let tmpDir = "";
    if (!useLambda) {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "slider-render-"));
    }

    // --- PREPARE ASSETS ---
    let audioDataUrl: string | null = null;

    // --- DEFAULT MUSIC LOGIC ---
    if (!payload.audioPreset && !payload.audio) {
      try {
        const musicDir = path.join(process.cwd(), "public", "slideshow-music-library");
        const files = await readdir(musicDir);
        const supportedExts = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"];
        const musicFiles = files.filter(f => supportedExts.includes(path.extname(f).toLowerCase()));

        if (musicFiles.length > 0) {
          const randomFile = musicFiles[Math.floor(Math.random() * musicFiles.length)];
          console.log(`[API] No audio provided. Defaulting to random music: ${randomFile}`);
          payload.audioPreset = randomFile;
        }
      } catch (err) {
        console.warn("[API] Failed to select random default music:", err);
      }
    }

    if (payload.audioPreset) {
      const presetPath = path.join(process.cwd(), "public", "slideshow-music-library", path.basename(payload.audioPreset));
      if (useLambda) {
        // Read file and upload to S3
        const fileBuffer = await fs.readFile(presetPath);
        const base64 = `data:audio/mp3;base64,${fileBuffer.toString("base64")}`;
        const filename = `preset-${path.basename(payload.audioPreset)}`;
        audioDataUrl = await uploadBase64ToS3(base64, filename);
      } else {
        audioDataUrl = `file://${presetPath}`;
      }
    } else if (payload.audio) {
      if (useLambda) {
        if (payload.audio.startsWith("data:")) {
          audioDataUrl = await resolveAsset(payload.audio, tmpDir, "audio", true);
        } else {
          audioDataUrl = payload.audio;
        }
      } else {
        // Existing logic for local
        if (payload.audio.startsWith('data:')) {
          audioDataUrl = await saveBase64ToFile(payload.audio, tmpDir, 'audio');
        } else if (/^https?:\/\//i.test(payload.audio)) {
          // Remote URL - download it for local render
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
          audioDataUrl = payload.audio;
        }
      }
    }

    // Process Images
    if (payload.images && Array.isArray(payload.images)) {
      payload.images = await Promise.all(payload.images.map(async (item: string | { src: string; color?: string }, i: number) => {
        if (typeof item === 'string') {
          return resolveAsset(item, tmpDir, `slide-${i}`, useLambda);
        } else if (typeof item === 'object' && item.src) {
          const resolvedSrc = await resolveAsset(item.src, tmpDir, `slide-${i}`, useLambda);
          return { ...item, src: resolvedSrc };
        }
        return item;
      }));
    }

    if (payload.topImages && Array.isArray(payload.topImages)) {
      payload.topImages = await Promise.all(payload.topImages.map((img: string, i: number) =>
        resolveAsset(img, tmpDir, `top-${i}`, useLambda)
      ));
    }

    if (payload.bottomImages && Array.isArray(payload.bottomImages)) {
      payload.bottomImages = await Promise.all(payload.bottomImages.map((img: string, i: number) =>
        resolveAsset(img, tmpDir, `bottom-${i}`, useLambda)
      ));
    }

    const finalPayload = {
      ...payload,
      audio: audioDataUrl,
      audioLoop: payload.audioLoop,
      audioDuration: payload.audioDuration
    };

    // --- EXECUTE RENDER ---

    if (useLambda) {
      const region = (process.env.REMOTION_AWS_REGION || "ap-southeast-1") as AwsRegion;
      const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME!;
      const serveUrl = process.env.REMOTION_LAMBDA_SERVE_URL!;

      // Ensure standard AWS env vars are set for the SDK
      if (!process.env.AWS_ACCESS_KEY_ID) process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
      if (!process.env.AWS_SECRET_ACCESS_KEY) process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
      if (!process.env.AWS_REGION) process.env.AWS_REGION = region;

      // Determine props based on composition
      // We need to map payload to props expected by composition
      // The payload structure seems to match props mostly.

      console.log(`[API] Starting Lambda render: ${compositionId} on ${functionName}`);

      const { renderId, bucketName } = await renderMediaOnLambda({
        region,
        functionName,
        serveUrl,
        composition: compositionId,
        inputProps: finalPayload,
        codec: "h264",
        envVariables: {},
      });

      console.log(`[API] Render started. ID: ${renderId}, Bucket: ${bucketName}`);

      console.log(`[API] Render started. ID: ${renderId}, Bucket: ${bucketName}`);

      return NextResponse.json({
        type: 'lambda',
        renderId,
        bucketName,
        functionName,
        region,
      });


    } else {
      // --- LOCAL RENDER LOGIC ---
      const payloadPath: string = path.join(tmpDir, "payload.json");
      await fs.writeFile(payloadPath, JSON.stringify(finalPayload), "utf-8");

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
            if (lastLine.startsWith("/") || lastLine.match(/^[a-zA-Z]:\\/)) {
              resolve(lastLine);
            } else {
              resolve(lastLine);
            }
          } else {
            reject(new Error(`Render process exited with code ${code}: ${stderr}`));
          }
        });
        child.on("error", (err: Error) => reject(err));
      });

      const publicRendersDir = path.join(process.cwd(), "public", "renders");
      await fs.mkdir(publicRendersDir, { recursive: true });
      const publicFilePath = path.join(publicRendersDir, videoFileName);

      await fs.copyFile(outputPath, publicFilePath);
      await fs.rm(tmpDir, { recursive: true, force: true });

      const publicUrl = `/renders/${videoFileName}`;
      return NextResponse.json({ url: publicUrl });
    }

  } catch (error) {
    console.error("Remotion render failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
