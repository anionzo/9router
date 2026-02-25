import { getSettings } from "@/lib/localDb";
import { createEncryptedR2Backup, updateAutoBackupRunStatus } from "@/lib/backup/service";

const DEFAULT_INTERVAL_MINUTES = 360;
const INITIAL_DELAY_MS = 30000;
const CHECK_INTERVAL_MS = 60000;

function parseIntervalMinutes(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 5) {
    return DEFAULT_INTERVAL_MINUTES;
  }
  return parsed;
}

function getLastRunAtMs(settings) {
  if (!settings?.r2AutoBackupLastRunAt) return 0;
  const timestamp = Date.parse(settings.r2AutoBackupLastRunAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export class R2BackupScheduler {
  constructor() {
    this.intervalId = null;
    this.isExecuting = false;
  }

  start() {
    if (this.intervalId) {
      return;
    }

    setTimeout(() => {
      this.tick().catch(() => {});
    }, INITIAL_DELAY_MS);

    this.intervalId = setInterval(() => {
      this.tick().catch(() => {});
    }, CHECK_INTERVAL_MS);

    if (this.intervalId.unref) {
      this.intervalId.unref();
    }
  }

  stop() {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  isRunning() {
    return this.intervalId !== null;
  }

  async tick() {
    const settings = await getSettings();
    if (!settings?.r2AutoBackupEnabled) {
      return null;
    }

    const intervalMinutes = parseIntervalMinutes(settings.r2AutoBackupIntervalMinutes);
    const intervalMs = intervalMinutes * 60 * 1000;
    const lastRunAt = getLastRunAtMs(settings);

    if (lastRunAt > 0 && Date.now() - lastRunAt < intervalMs) {
      return null;
    }

    return this.runNow("scheduler");
  }

  async runNow(source = "manual") {
    if (this.isExecuting) {
      return { success: false, skipped: true, reason: "Backup is already running" };
    }

    this.isExecuting = true;
    const startedAt = new Date().toISOString();

    try {
      const result = await createEncryptedR2Backup();
      await updateAutoBackupRunStatus({
        startedAt,
        success: true,
        key: result.key,
      });

      return {
        success: true,
        key: result.key,
        retention: result.retention,
        source,
      };
    } catch (error) {
      await updateAutoBackupRunStatus({
        startedAt,
        success: false,
        error: error?.message || "Auto backup failed",
      });
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }
}

let schedulerInstance = null;

export function getR2BackupScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new R2BackupScheduler();
  }
  return schedulerInstance;
}
