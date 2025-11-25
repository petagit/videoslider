# Remotion Lambda Setup

This project is configured to use Remotion Lambda for serverless video rendering.

## Prerequisites

1.  **AWS Account**: You need an AWS account.
2.  **Permissions**: Your AWS user needs permissions to create Lambda functions, S3 buckets, and IAM roles.

## Setup Steps

### 1. Configure AWS Credentials

You can set your AWS credentials in a `.env` file (for local setup) or rely on `~/.aws/credentials`.

If using `.env`, add:
```env
REMOTION_AWS_ACCESS_KEY_ID=your_key
REMOTION_AWS_SECRET_ACCESS_KEY=your_secret
REMOTION_AWS_REGION=us-east-1
```

### 2. Deploy Lambda Infrastructure

Run the setup script to create the S3 bucket, Lambda function, and deploy the Remotion site:

```bash
npx tsx scripts/setup-lambda.ts
```

This script will output the configuration values you need.

### 3. Update Environment Variables

Add the following variables to your `.env.local` (and Vercel project settings):

```env
REMOTION_AWS_REGION=us-east-1
REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-...
REMOTION_LAMBDA_SERVE_URL=https://...
REMOTION_BUCKET=remotion-lambda-...
REMOTION_AWS_ACCESS_KEY_ID=...
REMOTION_AWS_SECRET_ACCESS_KEY=...
```

*Note: The setup script provides these values.*

## Usage

The API route `/api/render` automatically detects if `REMOTION_LAMBDA_FUNCTION_NAME` is set.
- **If set**: It uploads assets to S3, triggers Remotion Lambda, waits for completion, and returns the S3 URL of the video.
- **If not set**: It falls back to local rendering (using `scripts/render.js`).

## Architecture

- **Frontend (Vercel)**: User triggers render.
- **API (Vercel)**: `/api/render` receives payload.
  - Uploads base64 images/audio to S3.
  - Invokes Lambda function.
  - Polls for completion.
- **Remotion Lambda**: Renders the video using the deployed site bundle.
- **Storage (S3)**: Stores input assets and the final video.

## Troubleshooting

- **Timeouts**: Vercel functions have execution time limits. If rendering takes too long, consider returning the `renderId` immediately and implementing a polling endpoint on the client side instead of waiting in the API.
- **Permissions**: Ensure the AWS user has sufficient permissions.

