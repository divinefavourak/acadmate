import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAdmin } from "@/lib/auth/helpers";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, GIF, or WebP images are allowed" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 5 MB" }, { status: 400 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "acadmate/questions";

  // Cloudinary signature: alphabetically sorted params + api_secret
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  const buffer = Buffer.from(await file.arrayBuffer());
  const b64 = `data:${file.type};base64,${buffer.toString("base64")}`;

  const body = new FormData();
  body.append("file", b64);
  body.append("folder", folder);
  body.append("api_key", apiKey);
  body.append("timestamp", String(timestamp));
  body.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body }
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error("[upload] Cloudinary HTTP error:", res.status, detail);
    return NextResponse.json({ error: "Upload failed", detail }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ url: data.secure_url });
}
