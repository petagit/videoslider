#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Minimal Node renderer to decouple heavy deps from Next bundler
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const http = require('node:http');
const { createReadStream } = require('node:fs');

// Simple static file server to bypass file:// restrictions in headless Chrome
function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      try {
        // Decode URL to handle spaces and special chars
        const filePath = decodeURIComponent(req.url ?? '');
        if (!filePath || filePath === '/') {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }
        
        // Since we serve root, the URL path is the absolute file path
        // We need to be careful about security in a real app, but this is a local ephemeral render script.
        const safePath = filePath; // In a real server, we'd sandbox this.
        
        const stream = createReadStream(safePath);
        stream.on('error', (err) => {
            console.error('Server error reading file:', safePath, err.message);
            res.statusCode = 404;
            res.end('Not found');
        });
        stream.pipe(res);
      } catch (e) {
        console.error('Server error:', e);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' ? address?.port : 0;
      resolve({ server, port });
    });
  });
}

async function main() {
  const [payloadPath, fileName, compositionId = 'slider-reveal'] = process.argv.slice(2);
  if (!payloadPath || !fileName) {
    console.error('Usage: render <payload.json> <output-file-name> [composition-id]');
    process.exit(2);
  }

  // Start static server
  const { server, port } = await startStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  
  // Helper to convert file:// to http://
  const convertUrl = (url) => {
    if (typeof url === 'string' && url.startsWith('file://')) {
        const filePath = url.slice(7); // Remove 'file://'
        return `${baseUrl}${filePath}`;
    }
    return url;
  };

  let payload = JSON.parse(await fs.readFile(payloadPath, 'utf-8'));
  
  // Rewrite paths in payload
  if (payload.audio) payload.audio = convertUrl(payload.audio);
  if (payload.images) {
    payload.images = payload.images.map(img => {
      if (typeof img === 'string') {
        return convertUrl(img);
      } else if (typeof img === 'object' && img !== null && img.src) {
        // Handle { src: string, color?: string } objects
        return { ...img, src: convertUrl(img.src) };
      }
      return img;
    });
  }
  if (payload.topImages) payload.topImages = payload.topImages.map(convertUrl);
  if (payload.bottomImages) payload.bottomImages = payload.bottomImages.map(convertUrl);
  
  const audioDataUrl = payload.audio;

  // Validation logic specific to slider-reveal
  if (compositionId === 'slider-reveal') {
    const { topImages = [], bottomImages = [] } = payload;
    if (!Array.isArray(topImages) || !Array.isArray(bottomImages)) {
      server.close();
      throw new Error('Expected photo arrays in payload.');
    }

    if (topImages.length !== bottomImages.length) {
      server.close();
      throw new Error('Top and bottom photo counts must match.');
    }

    if (topImages.length === 0) {
      server.close();
      throw new Error('Add at least one photo pair before rendering.');
    }
  } else if (compositionId === 'slideshow') {
    const { images = [] } = payload;
    if (!Array.isArray(images) || images.length === 0) {
      server.close();
      throw new Error('No images provided for slideshow');
    }
    // Validate images have proper src
    const hasValidImages = images.every(img => 
      (typeof img === 'string' && img.length > 0) || 
      (typeof img === 'object' && img !== null && img.src)
    );
    if (!hasValidImages) {
      server.close();
      throw new Error('Invalid image format in slideshow payload');
    }
  }

  // Generic props handling
  const frameRate = payload.animation?.frameRate ?? 30;
  
  let durationInFrames = undefined;

  if (compositionId === 'slider-reveal') {
    const { topImages = [], animation } = payload;
    const durationMs = animation?.durationMs ?? 3000;
    const framesPerSegment = Math.max(1, Math.round((durationMs / 1000) * frameRate));
    durationInFrames = framesPerSegment * topImages.length;
  } else if (compositionId === 'slideshow') {
    const { images = [], durationPerSlide = 1.5 } = payload;
    const count = images.length;
    durationInFrames = Math.round(count * durationPerSlide * frameRate);
    if (count === 0) durationInFrames = 30;
  }

  // Require here so Next.js doesn't try to bundle these modules
  const { bundle } = require('@remotion/bundler');
  const { renderMedia, getCompositions } = require('@remotion/renderer');

  const remotionRoot = path.join(process.cwd(), 'remotion');
  const entryPoint = path.join(remotionRoot, 'index.ts');

  const bundleLocation = await bundle({
    entryPoint,
    outDir: undefined,
    // Silence bundle progress
    onProgress: () => {},
  });

  const compositions = await getCompositions(bundleLocation, {
    inputProps: payload, 
  });
  const base = compositions.find((c) => c.id === compositionId);
  if (!base) {
    server.close();
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

  try {
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
        logLevel: 'error',
  });

  // Print the output path so the caller can read it
  process.stdout.write(outputLocation);
  } finally {
      server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
