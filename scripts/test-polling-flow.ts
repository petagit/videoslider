import fs from 'fs';

async function testPollingFlow() {
    const baseUrl = 'http://localhost:3000';

    console.log('1. Uploading dummy content to S3...');
    // 1. Get Upload URL
    const uploadRes = await fetch(`${baseUrl}/api/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'poll-test.png', contentType: 'image/png' })
    });
    const { uploadUrl, fileUrl } = await uploadRes.json();

    // 2. Upload
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: pngBuffer });
    console.log('   Upload successful.');

    console.log('2. Starting Render...');
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

    if (!renderRes.ok) throw new Error(`Render start failed: ${await renderRes.text()}`);

    const renderData = await renderRes.json();
    console.log('   Render started:', renderData);

    const { renderId, bucketName, functionName, region } = renderData;
    if (!renderId) throw new Error('No renderId returned');

    console.log('3. Polling Status...');
    while (true) {
        await new Promise(r => setTimeout(r, 2000));

        const statusRes = await fetch(`${baseUrl}/api/render/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ renderId, bucketName, functionName, region })
        });

        const status = await statusRes.json();
        console.log(`   Progress: ${Math.round(status.overallProgress * 100)}% | Done: ${status.done}`);

        if (status.fatalErrorEncountered) {
            console.error('   Fatal Error:', status.errors);
            break;
        }

        if (status.done) {
            console.log('   Render Complete! URL:', status.outputFile);
            break;
        }
    }
}

testPollingFlow().catch(console.error);
