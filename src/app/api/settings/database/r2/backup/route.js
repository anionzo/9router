import { NextResponse } from "next/server";
import { createEncryptedR2Backup, updateAutoBackupRunStatus } from "@/lib/backup/service";

export async function POST() {
  const startedAt = new Date().toISOString();
  try {
    const result = await createEncryptedR2Backup();
    await updateAutoBackupRunStatus({
      startedAt,
      success: true,
      key: result.key,
    });

    return NextResponse.json({
      success: true,
      key: result.key,
      retention: result.retention,
    });
  } catch (error) {
    await updateAutoBackupRunStatus({
      startedAt,
      success: false,
      error: error?.message || "Failed to create encrypted backup",
    });
    console.log("Error creating R2 database backup:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create encrypted backup" },
      { status: 500 }
    );
  }
}
