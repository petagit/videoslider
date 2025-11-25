import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/s3-upload";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
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
        return NextResponse.json(
            { error: "Failed to generate upload URL" },
            { status: 500 }
        );
    }
}
