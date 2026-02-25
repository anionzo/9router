import { NextResponse } from "next/server";
import { exportDb, importDb } from "@/lib/localDb";
import { decryptBackupPayload, encryptBackupPayload } from "@/lib/backup/crypto";
import { downloadEncryptedBackup, uploadEncryptedBackup } from "@/lib/backup/r2";

export async function POST(request) {
  try {
    const body = await request.json();
    const key = body?.key;
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Backup key is required" }, { status: 400 });
    }

    const beforeRestore = await exportDb();
    const beforeEncrypted = encryptBackupPayload(beforeRestore);
    await uploadEncryptedBackup(beforeEncrypted);

    const { buffer } = await downloadEncryptedBackup(key);
    const payload = decryptBackupPayload(buffer);
    await importDb(payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error restoring R2 backup:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to restore backup" },
      { status: 500 }
    );
  }
}
