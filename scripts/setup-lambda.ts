import { deployFunction, deploySite, getOrCreateBucket } from "@remotion/lambda";
import path from "path";
import dotenv from "dotenv";
import {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  GetRoleCommand,
} from "@aws-sdk/client-iam";

dotenv.config();

async function ensureRole(region: string) {
  const client = new IAMClient({
    region,
    credentials: {
      accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
    },
  });
  const roleName = "remotion-lambda-role";

  try {
    await client.send(new GetRoleCommand({ RoleName: roleName }));
    console.log("   - Role exists.");
  } catch (e: any) {
    if (e.name === "NoSuchEntityException") {
      console.log("   - Role not found. Creating...");
      try {
      await client.send(
        new CreateRoleCommand({
          RoleName: roleName,
          AssumeRolePolicyDocument: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: { Service: "lambda.amazonaws.com" },
                Action: "sts:AssumeRole",
              },
            ],
          }),
        })
      );
      
      // Attach policies
      const policies = [
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        "arn:aws:iam::aws:policy/AmazonS3FullAccess", 
      ];

      for (const policyArn of policies) {
         await client.send(new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }));
      }

      console.log("   - Role created. Waiting for propagation...");
      await new Promise((r) => setTimeout(r, 10000));
      } catch (createErr: any) {
          console.error("   - Failed to create role:", createErr.message);
          throw createErr;
      }
    } else {
        console.error("   - Error checking role:", e.message);
    }
  }
}

// Helper to deploy Lambda
async function main() {
  console.log("🚀 Starting Remotion Lambda setup...");

  const region = process.env.REMOTION_AWS_REGION || "us-east-1";
  console.log(`📍 Region: ${region}`);

  try {
    // Pre-check Role
    await ensureRole(region);

    // 1. Get or Create Bucket
    console.log("📦 Checking/Creating S3 Bucket...");
    const { bucketName } = await getOrCreateBucket({ region });
    console.log(`✅ Bucket: ${bucketName}`);

    // 2. Deploy Function
    console.log("⚡ Deploying Lambda function...");
    const { functionName } = await deployFunction({
      region,
      architecture: "arm64",
      memorySizeInMb: 2048,
      timeoutInSeconds: 240,
      createCloudWatchLogGroup: true,
    });
    console.log(`✅ Function: ${functionName}`);

    // 3. Deploy Site
    console.log("🌐 Deploying Remotion Site...");
    const { serveUrl } = await deploySite({
      bucketName,
      entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
      siteName: "video-editor-site",
      region,
    });
    console.log(`✅ Site URL: ${serveUrl}`);

    console.log("\n🎉 Setup complete! Add these to your .env file:\n");
    console.log(`REMOTION_AWS_REGION=${region}`);
    console.log(`REMOTION_LAMBDA_FUNCTION_NAME=${functionName}`);
    console.log(`REMOTION_LAMBDA_SERVE_URL=${serveUrl}`);
    console.log(`REMOTION_BUCKET=${bucketName}`);
    console.log(`REMOTION_AWS_ACCESS_KEY_ID=your_access_key`);
    console.log(`REMOTION_AWS_SECRET_ACCESS_KEY=your_secret_key`);

  } catch (err) {
    console.error("❌ Setup failed:", err);
    console.error("Ensure you have AWS credentials configured.");
  }
}

main();

