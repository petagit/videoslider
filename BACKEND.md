# Backend & Rendering Architecture

This project uses a hybrid rendering engine that supports both **Local Rendering** (using FFmpeg on the server) and **Cloud Rendering** (using AWS Lambda via Remotion Lambda).

## 🚀 Is Remotion Lambda Working?

**Yes, the infrastructure is deployed.**

- **Lambda Function**: `remotion-render-4-0-377-mem2048mb-disk2048mb-240sec` (Deployed in `us-east-2`)
- **S3 Bucket**: `remotionlambda-useast2-64q23k10am`
- **Render Site**: Hosted on S3 (This is the React bundle the Lambda visits to generate frames).

To enable it in your application, ensure your `.env` file contains the values from `credential.sm`. When `REMOTION_LAMBDA_FUNCTION_NAME` is detected, the API automatically switches to Lambda mode.

---

## 🛠 How It Works

### 1. The API Route (`/api/render`)

The core logic lives in `src/app/api/render/route.ts`. It handles the request in three stages:

#### Stage A: Asset Resolution
The frontend sends a JSON payload with base64 images or URLs. The Lambda cannot access local files on your Vercel/Next.js server, so we must make them accessible via the web.
1.  **Base64 Data**: Converted to buffers and uploaded to your S3 Bucket (`uploads/` prefix).
2.  **Local Audio Presets**: Read from disk and uploaded to S3.
3.  **Remote URLs**: Passed through as-is (if publicly accessible).

#### Stage B: Triggering the Render
Once all assets have public S3 URLs, the API calls `renderMediaOnLambda()`.
-   **Input**: The cleaned payload with S3 URLs.
-   **Composition**: The ID of the video template (e.g., `slider-reveal`).
-   **Serve URL**: The URL of your deployed Remotion site (the "frontend" for the bot).

#### Stage C: Polling & Result
The API polls `getRenderProgress()` every 2 seconds until the video is done.
-   **Success**: Returns the S3 URL of the final MP4.
-   **Failure**: Throws an error with the Lambda logs.

### 2. Infrastructure Components

| Component | Purpose |
|-----------|---------|
| **AWS S3** | Stores input assets (images/audio) and the output MP4 video. Also hosts the "site" (bundle). |
| **AWS Lambda** | A headless browser (Chromium) that opens the "site", takes screenshots of every frame, and stitches them with FFmpeg. |
| **AWS IAM** | `remotion-lambda-role` grants the Lambda permission to read/write to the S3 bucket. |

### 3. Local Fallback (Dev Mode)
If `REMOTION_LAMBDA_FUNCTION_NAME` is missing from environment variables, the system falls back to `scripts/render.js`:
1.  Writes payload to a temporary JSON file.
2.  Spawns a child process running `remotion render`.
3.  Uses the local machine's FFmpeg to generate the video.
4.  Saves the file to `public/renders/`.

## 📦 Deployment & Setup

### Prerequisites
- AWS Account with permissions for S3, Lambda, and IAM.
- Dependencies installed: `@remotion/lambda`, `@aws-sdk/client-s3`.

### Setup Script
We use `scripts/setup-lambda.ts` to automate the infrastructure:
```bash
npx tsx scripts/setup-lambda.ts
```
This script:
1.  Checks/Creates the IAM Role.
2.  Creates a region-specific S3 Bucket.
3.  Deploys the Lambda function (if not exists).
4.  Bundles the Remotion project (`remotion/index.ts`) and uploads it to S3.

### Environment Variables
Required for Lambda rendering to activate:

```properties
REMOTION_AWS_ACCESS_KEY_ID=...
REMOTION_AWS_SECRET_ACCESS_KEY=...
REMOTION_AWS_REGION=us-east-2
REMOTION_BUCKET=...
REMOTION_LAMBDA_FUNCTION_NAME=...
REMOTION_LAMBDA_SERVE_URL=...
```

