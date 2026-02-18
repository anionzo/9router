"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, Badge, Toggle, Input } from "@/shared/components";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";
import { useTranslations } from "next-intl";

export default function ProfilePage() {
  const t = useTranslations();
  const { theme, setTheme, isDark } = useTheme();
  const [settings, setSettings] = useState({ fallbackStrategy: "fill-first" });
  const [loading, setLoading] = useState(true);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [passStatus, setPassStatus] = useState({ type: "", message: "" });
  const [passLoading, setPassLoading] = useState(false);
  const [dbExporting, setDbExporting] = useState(false);
  const [dbImporting, setDbImporting] = useState(false);
  const [dbStatus, setDbStatus] = useState({ type: "", message: "" });
  const dbFileInputRef = useRef(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch settings:", err);
        setLoading(false);
      });
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setPassStatus({ type: "error", message: t("profile.security.passwordMismatch") });
      return;
    }

    setPassLoading(true);
    setPassStatus({ type: "", message: "" });

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPassStatus({ type: "success", message: t("profile.security.passwordUpdated") });
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        setPassStatus({ type: "error", message: data.error || t("profile.security.passwordUpdateFailed") });
      }
    } catch (err) {
      setPassStatus({ type: "error", message: t("profile.common.genericError") });
    } finally {
      setPassLoading(false);
    }
  };

  const updateFallbackStrategy = async (strategy) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fallbackStrategy: strategy }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, fallbackStrategy: strategy }));
      }
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  };

  const updateStickyLimit = async (limit) => {
    const numLimit = parseInt(limit);
    if (isNaN(numLimit) || numLimit < 1) return;

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stickyRoundRobinLimit: numLimit }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, stickyRoundRobinLimit: numLimit }));
      }
    } catch (err) {
      console.error("Failed to update sticky limit:", err);
    }
  };

  const updateRequireLogin = async (requireLogin) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireLogin }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, requireLogin }));
      }
    } catch (err) {
      console.error("Failed to update require login:", err);
    }
  };

  const handleExportDb = async () => {
    setDbExporting(true);
    setDbStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/db?download=1");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDbStatus({ type: "error", message: data.error || t("profile.data.exportFailed") });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const header = res.headers.get("content-disposition") || "";
      const match = header.match(/filename="?([^";]+)"?/i);
      anchor.href = url;
      anchor.download = match?.[1] || "9router-db.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setDbStatus({ type: "success", message: t("profile.data.exportSuccess") });
    } catch (error) {
      setDbStatus({ type: "error", message: t("profile.data.exportFailed") });
    } finally {
      setDbExporting(false);
    }
  };

  const handleImportDb = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDbImporting(true);
    setDbStatus({ type: "", message: "" });
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed }),
      });
      const result = await res.json();
      if (!res.ok) {
        setDbStatus({ type: "error", message: result.error || t("profile.data.importFailed") });
        return;
      }

      setDbStatus({ type: "success", message: t("profile.data.importSuccess") });
    } catch (error) {
      setDbStatus({ type: "error", message: t("profile.data.invalidJson") });
    } finally {
      setDbImporting(false);
      event.target.value = "";
    }
  };

  const handleImportClick = () => {
    if (dbImporting) return;
    dbFileInputRef.current?.click();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col gap-6">
        {/* Local Mode Info */}
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">computer</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t("profile.localMode.title")}</h2>
              <p className="text-text-muted">{t("profile.localMode.subtitle")}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-text-muted">
              {t("profile.localMode.desc")} <code className="bg-sidebar px-1 rounded">~/.9router/db.json</code> {t("profile.localMode.descSuffix")}
            </p>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[20px]">shield</span>
            </div>
            <h3 className="text-lg font-semibold">{t("profile.security.title")}</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("profile.security.requireLogin")}</p>
                <p className="text-sm text-text-muted">{t("profile.security.requireLoginDesc")}</p>
              </div>
              <Toggle
                checked={settings.requireLogin === true}
                onChange={() => updateRequireLogin(!settings.requireLogin)}
                disabled={loading}
              />
            </div>
            {settings.requireLogin === true && (
              <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 pt-4 border-t border-border/50">
                {settings.hasPassword && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t("profile.security.currentPassword")}</label>
                    <Input
                      type="password"
                      placeholder={t("profile.security.currentPasswordPlaceholder")}
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      required
                    />
                  </div>
                )}
                {/* {!settings.hasPassword && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Setting password for the first time. Leave current password empty or use default: <code className="bg-blue-500/20 px-1 rounded">123456</code>
                    </p>
                  </div>
                )} */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t("profile.security.newPassword")}</label>
                    <Input
                      type="password"
                      placeholder={t("profile.security.newPasswordPlaceholder")}
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t("profile.security.confirmPassword")}</label>
                    <Input
                      type="password"
                      placeholder={t("profile.security.confirmPasswordPlaceholder")}
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {passStatus.message && (
                  <p className={`text-sm ${passStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
                    {passStatus.message}
                  </p>
                )}

                <div className="pt-2">
                  <Button type="submit" variant="primary" loading={passLoading}>
                    {settings.hasPassword ? t("profile.security.updatePassword") : t("profile.security.setPassword")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>

        {/* Routing Preferences */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <span className="material-symbols-outlined text-[20px]">route</span>
            </div>
            <h3 className="text-lg font-semibold">{t("profile.routing.title")}</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("profile.routing.roundRobin")}</p>
                <p className="text-sm text-text-muted">{t("profile.routing.roundRobinDesc")}</p>
              </div>
              <Toggle
                checked={settings.fallbackStrategy === "round-robin"}
                onChange={() => updateFallbackStrategy(settings.fallbackStrategy === "round-robin" ? "fill-first" : "round-robin")}
                disabled={loading}
              />
            </div>

            {/* Sticky Round Robin Limit */}
            {settings.fallbackStrategy === "round-robin" && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div>
                  <p className="font-medium">{t("profile.routing.stickyLimit")}</p>
                  <p className="text-sm text-text-muted">{t("profile.routing.stickyLimitDesc")}</p>
                </div>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.stickyRoundRobinLimit || 3}
                  onChange={(e) => updateStickyLimit(e.target.value)}
                  disabled={loading}
                  className="w-20 text-center"
                />
              </div>
            )}

            <p className="text-xs text-text-muted italic pt-2 border-t border-border/50">
              {settings.fallbackStrategy === "round-robin"
                ? t("profile.routing.roundRobinStatus", { count: settings.stickyRoundRobinLimit || 3 })
                : t("profile.routing.fillFirstStatus")}
            </p>
          </div>
        </Card>

        {/* Theme Preferences */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <span className="material-symbols-outlined text-[20px]">palette</span>
            </div>
            <h3 className="text-lg font-semibold">{t("profile.appearance.title")}</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("profile.appearance.darkMode")}</p>
                <p className="text-sm text-text-muted">{t("profile.appearance.darkModeDesc")}</p>
              </div>
              <Toggle
                checked={isDark}
                onChange={() => setTheme(isDark ? "light" : "dark")}
              />
            </div>

            {/* Theme Options */}
            <div className="pt-4 border-t border-border">
              <div className="inline-flex p-1 rounded-lg bg-black/5 dark:bg-white/5">
                {["light", "dark", "system"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTheme(option)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all",
                      theme === option
                        ? "bg-white dark:bg-white/10 text-text-main shadow-sm"
                        : "text-text-muted hover:text-text-main"
                    )}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {option === "light" ? "light_mode" : option === "dark" ? "dark_mode" : "contrast"}
                    </span>
                    <span className="capitalize">{t(`profile.appearance.theme.${option}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Data Management */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
              <span className="material-symbols-outlined text-[20px]">database</span>
            </div>
            <h3 className="text-lg font-semibold">{t("profile.data.title")}</h3>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 rounded-lg bg-bg border border-border">
              <div>
                <p className="font-medium">{t("profile.data.location")}</p>
                <p className="text-sm text-text-muted font-mono">~/.9router/db.json</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" icon="download" onClick={handleExportDb} loading={dbExporting}>
                {t("profile.data.export")}
              </Button>
              <input
                ref={dbFileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportDb}
                className="hidden"
                disabled={dbImporting}
              />
              <Button variant="outline" icon="upload" onClick={handleImportClick} disabled={dbImporting}>
                {t("profile.data.import")}
              </Button>
              <span className="text-xs text-text-muted">{t("profile.data.importHint")}</span>
            </div>
            {dbStatus.message && (
              <p className={`text-sm ${dbStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
                {dbStatus.message}
              </p>
            )}
          </div>
        </Card>

        {/* App Info */}
        <div className="text-center text-sm text-text-muted py-4">
          <p>{APP_CONFIG.name} v{APP_CONFIG.version}</p>
          <p className="mt-1">{t("profile.localMode.footer")}</p>
        </div>
      </div>
    </div>
  );
}
