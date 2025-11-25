import fs from 'fs';
import path from 'path';

async function testFlow() {
    const baseUrl = 'http://localhost:3000';

    console.log('1. Testing /api/upload-url...');
    const uploadRes = await fetch(`${baseUrl}/api/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'test-image.png', contentType: 'image/png' })
    });

    if (!uploadRes.ok) {
        throw new Error(`Failed to get upload URL: ${uploadRes.status} ${await uploadRes.text()}`);
    }

    const { uploadUrl, fileUrl } = await uploadRes.json();
    console.log('   Got upload URL:', uploadUrl);
    console.log('   Got file URL:', fileUrl);

    console.log('2. Uploading dummy content to S3...');
    // Create a minimal valid PNG buffer
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

    const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: pngBuffer
    });

    if (!s3Res.ok) {
        throw new Error(`Failed to upload to S3: ${s3Res.status} ${await s3Res.text()}`);
    }
    console.log('   Upload successful.');

    console.log('3. Triggering render with S3 URL...');
    const renderRes = await fetch(`${baseUrl}/api/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            compositionId: 'slideshow',
            images: [fileUrl],
            durationPerSlide: 1,
            renderMode: 'lambda'
        })
    });

    if (!renderRes.ok) {
        throw new Error(`Render failed: ${renderRes.status} ${await renderRes.text()}`);
    }

    const renderData = await renderRes.json();
    console.log('   Render started/completed. Result:', renderData);
}

testFlow().catch(console.error);
