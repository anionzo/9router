import { NextResponse } from "next/server";
import { exportDb } from "@/lib/localDb";
import { encryptBackupPayload } from "@/lib/backup/crypto";
import { uploadEncryptedBackup } from "@/lib/backup/r2";

export async function POST() {
  try {
    const payload = await exportDb();
    const encrypted = encryptBackupPayload(payload);
    const result = await uploadEncryptedBackup(encrypted);

    return NextResponse.json({
      success: true,
      key: result.key,
      retention: result.retention,
    });
  } catch (error) {
    console.log("Error creating R2 database backup:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create encrypted backup" },
      { status: 500 }
    );
  }
}
