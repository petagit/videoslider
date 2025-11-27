import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const region = process.env.REMOTION_AWS_REGION || "us-east-1";
    const bucketName = process.env.REMOTION_BUCKET;

    if (!bucketName) {
        console.error("❌ REMOTION_BUCKET is not defined in .env");
        process.exit(1);
    }

    console.log(`Configuring CORS for bucket: ${bucketName} in ${region}`);

    const s3Client = new S3Client({
        region,
        credentials: {
            accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
        },
    });

    try {
        await s3Client.send(
            new PutBucketCorsCommand({
                Bucket: bucketName,
                CORSConfiguration: {
                    CORSRules: [
                        {
                            AllowedHeaders: ["*"],
                            AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
                            AllowedOrigins: ["*"], // Allow all origins for now to fix the issue
                            ExposeHeaders: ["ETag"],
                            MaxAgeSeconds: 3000,
                        },
                    ],
                },
            })
        );
        console.log("✅ Successfully updated CORS configuration!");
    } catch (err) {
        console.error("❌ Failed to update CORS configuration:", err);
        process.exit(1);
    }
}

main();
