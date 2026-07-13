import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, fileSize, fileType, chunkSize = 5000000, folder = "ndjourney-web" } = body;

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `${session.user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileName.split(".").pop()?.toLowerCase() || "bin"}`;
    const resourceType = fileType.startsWith("video/") ? "video" : "image";

    const paramsToSign: Record<string, string> = {
      public_id: publicId,
      resource_type: resourceType,
      folder,
      type: "upload",
      timestamp: String(timestamp),
    };

    if (fileSize > chunkSize) {
      paramsToSign.chunk_size = String(chunkSize);
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    const signedParams = {
      ...paramsToSign,
      signature,
      api_key: process.env.CLOUDINARY_API_KEY!,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    };

    const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

    // Test if signature is valid
    const testFormData = new FormData();
    Object.entries(signedParams).forEach(([k, v]) => testFormData.append(k, v));
    testFormData.append("file", new Blob(["test"], { type: "text/plain" }));

    let testResult = { ok: false, status: 0, body: "" };
    try {
      const testResp = await fetch(uploadUrl, { method: "POST", body: testFormData });
      testResult = { ok: testResp.ok, status: testResp.status, body: await testResp.text() };
    } catch (e) {
      testResult = { ok: false, status: 0, body: e instanceof Error ? e.message : "Unknown" };
    }

    return NextResponse.json({
      uploadUrl,
      signedParams,
      signature,
      testResult,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    console.error("Test signature error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}