import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { createReadStream } from "fs";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const file = searchParams.get("file");

    if (!file) {
        return NextResponse.json({ error: "File parameter missing" }, { status: 400 });
    }

    // Sanitize filename to prevent traversal
    const filename = path.basename(file);
    const filePath = path.join(process.cwd(), "public", "renders", filename);

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stats = fs.statSync(filePath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = createReadStream(filePath) as any;

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "video/mp4",
            "Content-Length": stats.size.toString(),
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}

