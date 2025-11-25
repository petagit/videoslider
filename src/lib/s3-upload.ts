import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.REMOTION_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function uploadBase64ToS3(
  base64Str: string,
  filename: string
): Promise<string> {
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    // If it's already a URL, return it
    if (base64Str.startsWith("http")) return base64Str;
    throw new Error("Invalid base64 string");
  }

  const contentType = matches[1];
  const buffer = Buffer.from(matches[2], "base64");
  const bucketName = process.env.REMOTION_BUCKET;

  if (!bucketName) {
    throw new Error("REMOTION_BUCKET env var not set");
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: `uploads/${filename}`,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read", // Optional: ensure objects are public if needed, or use presigned URLs
  });

  await s3Client.send(command);

  // Construct Public URL (assuming public bucket or cloudfront)
  // Remotion Lambda buckets are usually private by default but Remotion handles access?
  // Actually, Remotion Lambda needs `serveUrl` (the bundle).
  // But for input props (images), if they are in S3, we can pass the S3 URL or Presigned URL.
  // If the Lambda is in the same region, it can read from S3 if permissions allow.
  // For simplicity, let's assume we return a signed URL or a public URL.
  // If ACL is public-read:
  return `https://${bucketName}.s3.${process.env.REMOTION_AWS_REGION || "us-east-1"}.amazonaws.com/uploads/${filename}`;
}

export async function uploadBufferToS3(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const bucketName = process.env.REMOTION_BUCKET;
  if (!bucketName) throw new Error("REMOTION_BUCKET env var not set");

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: `uploads/${filename}`,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
    })
  );

  return `https://${bucketName}.s3.${process.env.REMOTION_AWS_REGION || "us-east-1"}.amazonaws.com/uploads/${filename}`;
}

