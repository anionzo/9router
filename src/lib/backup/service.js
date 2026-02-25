import { exportDb, importDb, getSettings, updateSettings } from "@/lib/localDb";
import { decryptBackupPayload, encryptBackupPayload } from "@/lib/backup/crypto";
import { downloadEncryptedBackup, uploadEncryptedBackup } from "@/lib/backup/r2";

export async function createEncryptedR2Backup() {
  const payload = await exportDb();
  const encrypted = encryptBackupPayload(payload);
  const result = await uploadEncryptedBackup(encrypted);

  return {
    key: result.key,
    retention: result.retention,
  };
}

export async function restoreFromEncryptedR2Backup(key) {
  const beforeRestore = await exportDb();
  const beforeEncrypted = encryptBackupPayload(beforeRestore);
  await uploadEncryptedBackup(beforeEncrypted);

  const { buffer } = await downloadEncryptedBackup(key);
  const payload = decryptBackupPayload(buffer);
  await importDb(payload);

  return { success: true };
}

export async function updateAutoBackupRunStatus({ startedAt, success, key = null, error = null }) {
  const current = await getSettings();
  const next = {
    r2AutoBackupLastRunAt: startedAt,
    r2AutoBackupLastError: success ? null : (error || "Unknown error"),
  };

  if (success) {
    next.r2AutoBackupLastSuccessAt = startedAt;
    next.r2AutoBackupLastKey = key || current.r2AutoBackupLastKey || null;
  }

  return updateSettings(next);
}
