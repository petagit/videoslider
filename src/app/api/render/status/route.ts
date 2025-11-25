import { NextRequest, NextResponse } from "next/server";
import { getRenderProgress } from "@remotion/lambda/client";
import { AwsRegion } from "@remotion/lambda";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { renderId, bucketName, functionName, region } = body;

        if (!renderId || !bucketName || !functionName || !region) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        // Ensure credentials are set for the SDK
        if (!process.env.AWS_ACCESS_KEY_ID) process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
        if (!process.env.AWS_SECRET_ACCESS_KEY) process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
        if (!process.env.AWS_REGION) process.env.AWS_REGION = region;

        const progress = await getRenderProgress({
            region: region as AwsRegion,
            bucketName,
            renderId,
            functionName,
        });

        return NextResponse.json(progress);
    } catch (error) {
        console.error("Error checking render status:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
