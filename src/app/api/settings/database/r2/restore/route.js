import { NextResponse } from "next/server";
import { restoreFromEncryptedR2Backup } from "@/lib/backup/service";

export async function POST(request) {
  try {
    const body = await request.json();
    const key = body?.key;
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Backup key is required" }, { status: 400 });
    }

    await restoreFromEncryptedR2Backup(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error restoring R2 backup:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to restore backup" },
      { status: 500 }
    );
  }
}
