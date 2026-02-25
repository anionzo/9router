import { NextResponse } from "next/server";
import { listEncryptedBackups } from "@/lib/backup/r2";

export async function GET() {
  try {
    const backups = await listEncryptedBackups();
    return NextResponse.json({ backups });
  } catch (error) {
    console.log("Error listing R2 backups:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list backups" },
      { status: 500 }
    );
  }
}
