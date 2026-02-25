import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { getR2BackupScheduler } from "@/shared/services/r2BackupScheduler";

const ALLOWED_INTERVALS = new Set([360, 720, 1440]);

function normalizeInterval(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 360;
  }
  return ALLOWED_INTERVALS.has(parsed) ? parsed : 360;
}

export async function GET() {
  try {
    const settings = await getSettings();
    const scheduler = getR2BackupScheduler();

    return NextResponse.json({
      enabled: settings.r2AutoBackupEnabled === true,
      intervalMinutes: normalizeInterval(settings.r2AutoBackupIntervalMinutes),
      lastRunAt: settings.r2AutoBackupLastRunAt || null,
      lastSuccessAt: settings.r2AutoBackupLastSuccessAt || null,
      lastError: settings.r2AutoBackupLastError || null,
      lastKey: settings.r2AutoBackupLastKey || null,
      running: scheduler.isRunning(),
    });
  } catch (error) {
    console.log("Error fetching auto backup scheduler settings:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to get scheduler settings" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = body?.action;
    const scheduler = getR2BackupScheduler();

    if (action === "run-now") {
      const result = await scheduler.runNow("manual");
      return NextResponse.json({ success: true, result });
    }

    const enabled = body?.enabled === true;
    const intervalMinutes = normalizeInterval(body?.intervalMinutes);

    await updateSettings({
      r2AutoBackupEnabled: enabled,
      r2AutoBackupIntervalMinutes: intervalMinutes,
    });

    if (enabled) {
      scheduler.start();
    } else {
      scheduler.stop();
    }

    const settings = await getSettings();
    return NextResponse.json({
      success: true,
      enabled: settings.r2AutoBackupEnabled === true,
      intervalMinutes: normalizeInterval(settings.r2AutoBackupIntervalMinutes),
      running: scheduler.isRunning(),
      lastRunAt: settings.r2AutoBackupLastRunAt || null,
      lastSuccessAt: settings.r2AutoBackupLastSuccessAt || null,
      lastError: settings.r2AutoBackupLastError || null,
      lastKey: settings.r2AutoBackupLastKey || null,
    });
  } catch (error) {
    console.log("Error updating auto backup scheduler settings:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update scheduler settings" },
      { status: 500 }
    );
  }
}
