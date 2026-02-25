import { NextResponse } from "next/server";
import { deleteEncryptedBackup, listEncryptedBackups } from "@/lib/backup/r2";

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

export async function DELETE(request) {
  try {
    const body = await request.json();
    const key = body?.key;
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Backup key is required" }, { status: 400 });
    }

    const result = await deleteEncryptedBackup(key);
    return NextResponse.json({ success: true, key: result.key });
  } catch (error) {
    console.log("Error deleting R2 backup:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete backup" },
      { status: 500 }
    );
  }
}
