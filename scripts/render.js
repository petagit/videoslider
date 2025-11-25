#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Minimal Node renderer to decouple heavy deps from Next bundler
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');

async function main() {
  const [payloadPath, fileName, compositionId = 'slider-reveal'] = process.argv.slice(2);
  if (!payloadPath || !fileName) {
    console.error('Usage: render <payload.json> <output-file-name> [composition-id]');
    process.exit(2);
  }

  const payload = JSON.parse(await fs.readFile(payloadPath, 'utf-8'));
  const audioDataUrl = payload.audio;

  // Validation logic specific to slider-reveal
  if (compositionId === 'slider-reveal') {
    const { topImages = [], bottomImages = [] } = payload;
    if (!Array.isArray(topImages) || !Array.isArray(bottomImages)) {
      throw new Error('Expected photo arrays in payload.');
    }

    if (topImages.length !== bottomImages.length) {
      throw new Error('Top and bottom photo counts must match.');
    }

    if (topImages.length === 0) {
      throw new Error('Add at least one photo pair before rendering.');
    }
  } else if (compositionId === 'slideshow') {
    const { images = [] } = payload;
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('No images provided for slideshow');
    }
  }

  // Generic props handling
  const frameRate = payload.animation?.frameRate ?? 30;
  // For slider-reveal, we calculate duration based on animation props
  // For slideshow, it might be calculated differently or passed in. 
  // But Remotion's calculateMetadata in Root.tsx should handle the duration if we pass the right props.
  // However, we need to override durationInFrames here if we want to be explicit, 
  // OR we can rely on calculateMetadata if we don't set it here?
  // renderMedia uses the composition's duration if not specified.
  // But the original code calculated totalFrames manually.

  // Let's keep the manual calculation for slider-reveal for backward compatibility
  let durationInFrames = undefined;

  if (compositionId === 'slider-reveal') {
    const { topImages = [], animation } = payload;
    const durationMs = animation?.durationMs ?? 3000;
    const framesPerSegment = Math.max(1, Math.round((durationMs / 1000) * frameRate));
    durationInFrames = framesPerSegment * topImages.length;
  } else if (compositionId === 'slideshow') {
    // Calculate duration for slideshow based on payload
    // Total duration = N * D (no overlap/transition)
    
    const { images = [], durationPerSlide = 1.5 } = payload;
    const count = images.length;
    durationInFrames = Math.round(count * durationPerSlide * frameRate);
    if (count === 0) durationInFrames = 30;
  }
  // For slideshow, we let calculateMetadata handle it or calculate it here?
  // If we don't set durationInFrames in composition object passed to renderMedia, it uses the default from Root.tsx.
  // But Root.tsx has calculateMetadata which should run.
  // However, getCompositions returns the default metadata.
  // To get dynamic metadata based on props, we might need to use selectComposition or just pass props and let Remotion handle it?
  // renderMedia accepts `composition` object. If we modify it, we set the duration.

  // Require here so Next.js doesn't try to bundle these modules
  const { bundle } = require('@remotion/bundler');
  const { renderMedia, getCompositions } = require('@remotion/renderer');

  const remotionRoot = path.join(process.cwd(), 'remotion');
  const entryPoint = path.join(remotionRoot, 'index.ts');

  const bundleLocation = await bundle({ entryPoint, outDir: undefined });

  const compositions = await getCompositions(bundleLocation, {
    inputProps: payload, // Pass props to getCompositions to trigger calculateMetadata?
  });
  const base = compositions.find((c) => c.id === compositionId);
  if (!base) {
    throw new Error(`Composition "${compositionId}" not found`);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slider-render-'));
  const outputLocation = path.join(tmpDir, fileName);

  const composition = {
    ...base,
    fps: frameRate,
    props: { ...payload, audio: audioDataUrl },
  };

  if (durationInFrames) {
    composition.durationInFrames = durationInFrames;
  }

  await renderMedia({
    serveUrl: bundleLocation,
    composition,
    codec: 'h264',
    outputLocation,
    // inputProps intentionally omitted because props are supplied via composition
    onDownload: () => undefined,
    // Let Remotion embed audio from <Audio /> inside the composition
    audioCodec: 'aac',
    enforceAudioTrack: true,
    muted: false,
    // Keep stdout clean so parent can read only the output path
  });


  // Print the output path so the caller can read it
  process.stdout.write(outputLocation);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
