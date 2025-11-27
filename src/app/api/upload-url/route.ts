import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/s3-upload";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        // Check required environment variables
        const missingEnvVars: string[] = [];
        if (!process.env.REMOTION_BUCKET) missingEnvVars.push("REMOTION_BUCKET");
        if (!process.env.REMOTION_AWS_ACCESS_KEY_ID) missingEnvVars.push("REMOTION_AWS_ACCESS_KEY_ID");
        if (!process.env.REMOTION_AWS_SECRET_ACCESS_KEY) missingEnvVars.push("REMOTION_AWS_SECRET_ACCESS_KEY");
        
        if (missingEnvVars.length > 0) {
            console.error("Missing environment variables:", missingEnvVars);
            return NextResponse.json(
                { error: `Missing environment variables: ${missingEnvVars.join(", ")}` },
                { status: 500 }
            );
        }

        const { filename, contentType } = await request.json();

        if (!filename || !contentType) {
            return NextResponse.json(
                { error: "Missing filename or contentType" },
                { status: 400 }
            );
        }

        // Generate a unique filename to prevent collisions
        const uniqueFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;

        const { uploadUrl, fileUrl } = await getPresignedUrl(uniqueFilename, contentType);

        return NextResponse.json({ uploadUrl, fileUrl });
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: `Failed to generate upload URL: ${errorMessage}` },
            { status: 500 }
        );
    }
}
