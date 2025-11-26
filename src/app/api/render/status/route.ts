import { NextRequest, NextResponse } from "next/server";
import { getRenderProgress, AwsRegion } from "@remotion/lambda/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const { renderId, bucketName, functionName, region } = await request.json();

        if (!renderId || !bucketName || !functionName || !region) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        // Ensure AWS env vars are set for the SDK if not already
        if (!process.env.AWS_ACCESS_KEY_ID && process.env.REMOTION_AWS_ACCESS_KEY_ID) {
            process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
        }
        if (!process.env.AWS_SECRET_ACCESS_KEY && process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
            process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
        }
        if (!process.env.AWS_REGION) {
            process.env.AWS_REGION = region;
        }

        const progress = await getRenderProgress({
            renderId,
            bucketName,
            functionName,
            region: region as AwsRegion,
        });

        return NextResponse.json(progress);
    } catch (error) {
        console.error("Error fetching render progress:", error);
        return NextResponse.json(
            { error: "Failed to fetch render progress" },
            { status: 500 }
        );
    }
}
