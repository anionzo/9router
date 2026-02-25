"use client";

import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { Card, Button, Input, Modal, CardSkeleton, Toggle } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { OPENAI_COMPATIBLE_PREFIX, ANTHROPIC_COMPATIBLE_PREFIX } from "@/shared/constants/providers";

/* ========== CLOUD CODE — COMMENTED OUT (replaced by Tunnel) ==========
const DEFAULT_CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL || "";
const CLOUD_ACTION_TIMEOUT_MS = 15000;
========== END CLOUD CODE ========== */

const TUNNEL_BENEFITS = [
  { icon: "public", title: "Access Anywhere", desc: "Use your API from any network" },
  { icon: "group", title: "Share Endpoint", desc: "Share URL with team members" },
  { icon: "code", title: "Use in Cursor/Cline", desc: "Connect AI tools remotely" },
  { icon: "lock", title: "Encrypted", desc: "End-to-end TLS via Cloudflare" },
];

const POLICY_PATH_OPTIONS = [
  "/v1/chat/completions",
  "/v1/messages",
  "/v1/messages/count_tokens",
  "/v1/responses",
  "/v1/embeddings",
  "/v1/models",
  "/v1/api/chat",
];

const TUNNEL_ACTION_TIMEOUT_MS = 90000;

export default function APIPageClient({ machineId }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);

  /* ========== CLOUD STATE — COMMENTED OUT (replaced by Tunnel) ==========
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [cloudUrl, setCloudUrl] = useState(DEFAULT_CLOUD_URL);
  const [cloudUrlInput, setCloudUrlInput] = useState(DEFAULT_CLOUD_URL);
  const [cloudUrlSaving, setCloudUrlSaving] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupStatus, setSetupStatus] = useState(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(null);
  const [syncStep, setSyncStep] = useState("");
  ========== END CLOUD STATE ========== */

  // Tunnel state
  const [requireApiKey, setRequireApiKey] = useState(false);
  const [tunnelEnabled, setTunnelEnabled] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState("");
  const [tunnelShortId, setTunnelShortId] = useState("");
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelProgress, setTunnelProgress] = useState("");
  const [tunnelStatus, setTunnelStatus] = useState(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [policyKeyId, setPolicyKeyId] = useState("");
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyStatus, setPolicyStatus] = useState(null);
  const [availableModelOptions, setAvailableModelOptions] = useState([]);
  const [availablePrefixOptions, setAvailablePrefixOptions] = useState([]);
  const [modelSearch, setModelSearch] = useState("");
  const [customPrefixInput, setCustomPrefixInput] = useState("");
  const [customModelInput, setCustomModelInput] = useState("");
  const [policyForm, setPolicyForm] = useState({
    expiresAt: "",
    allowedPrefixes: [],
    allowedModels: [],
    allowedPaths: [],
  });

  const toLocalDateTime = (isoValue) => {
    if (!isoValue) return "";
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return "";
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const normalizeArrayField = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  const resetPolicyForm = () => {
    setPolicyForm({
      expiresAt: "",
      allowedPrefixes: [],
      allowedModels: [],
      allowedPaths: [],
    });
    setCustomPrefixInput("");
    setCustomModelInput("");
  };

  const normalizePrefixValue = (value) => {
    const text = String(value || "").trim().replace(/^\/+|\/+$/g, "");
    if (!text) return "";
    return `${text}/`;
  };

  const normalizeModelValue = (value) => String(value || "").trim();

  const filteredModelOptions = useMemo(() => {
    const merged = Array.from(new Set([...(availableModelOptions || []), ...(policyForm.allowedModels || [])]));
    const keyword = modelSearch.trim().toLowerCase();
    const base = keyword
      ? merged.filter((model) => model.toLowerCase().includes(keyword))
      : merged;
    return base.slice(0, 80);
  }, [availableModelOptions, modelSearch, policyForm.allowedModels]);

  const mergedPrefixOptions = useMemo(
    () => Array.from(new Set([...(availablePrefixOptions || []), ...(policyForm.allowedPrefixes || [])])).sort((a, b) => a.localeCompare(b)),
    [availablePrefixOptions, policyForm.allowedPrefixes]
  );

  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    fetchData();
    loadSettings();
  }, []);

  useEffect(() => {
    if (!policyKeyId && keys.length > 0) {
      setPolicyKeyId(keys[0].id);
      loadPolicy(keys[0].id);
    }
    if (policyKeyId && !keys.some((key) => key.id === policyKeyId)) {
      const nextId = keys[0]?.id || "";
      setPolicyKeyId(nextId);
      if (nextId) {
        loadPolicy(nextId);
      } else {
        resetPolicyForm();
      }
    }
    if (keys.length === 0) {
      setPolicyKeyId("");
      resetPolicyForm();
    }
  }, [keys]);

  /* ========== CLOUD FUNCTIONS — COMMENTED OUT (replaced by Tunnel) ==========
  const postCloudAction = async (action, timeoutMs = CLOUD_ACTION_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch("/api/sync/cloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (error) {
      if (error?.name === "AbortError") {
        return { ok: false, status: 408, data: { error: "Cloud request timeout" } };
      }
      return { ok: false, status: 500, data: { error: error.message || "Cloud request failed" } };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const loadCloudSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setCloudEnabled(data.cloudEnabled || false);
        setRequireApiKey(data.requireApiKey || false);
        const url = data.cloudUrl || DEFAULT_CLOUD_URL;
        setCloudUrl(url);
        setCloudUrlInput(url);
      }
    } catch (error) {
      console.log("Error loading cloud settings:", error);
    }
  };

  const handleCloudToggle = (checked) => {
    if (checked) {
      setShowCloudModal(true);
    } else {
      setShowDisableModal(true);
    }
  };

  const handleEnableCloud = async () => {
    setCloudSyncing(true);
    setSyncStep("syncing");
    try {
      const { ok, data } = await postCloudAction("enable");
      if (ok) {
        setSyncStep("verifying");
        if (data.verified) {
          setCloudEnabled(true);
          setCloudStatus({ type: "success", message: "Cloud Proxy connected and verified!" });
          setShowCloudModal(false);
        } else {
          setCloudEnabled(true);
          setCloudStatus({ type: "warning", message: data.verifyError || "Connected but verification failed" });
          setShowCloudModal(false);
        }
        if (data.createdKey) await fetchData();
      } else {
        setCloudStatus({ type: "error", message: data.error || "Failed to enable cloud" });
      }
    } catch (error) {
      setCloudStatus({ type: "error", message: error.message });
    } finally {
      setCloudSyncing(false);
      setSyncStep("");
    }
  };

  const handleConfirmDisable = async () => {
    setCloudSyncing(true);
    setSyncStep("syncing");
    try {
      await postCloudAction("sync");
      setSyncStep("disabling");
      const { ok, data } = await postCloudAction("disable");
      if (ok) {
        setCloudEnabled(false);
        setCloudStatus({ type: "success", message: "Cloud disabled" });
        setShowDisableModal(false);
      } else {
        setCloudStatus({ type: "error", message: data.error || "Failed to disable cloud" });
      }
    } catch (error) {
      setCloudStatus({ type: "error", message: "Failed to disable cloud" });
    } finally {
      setCloudSyncing(false);
      setSyncStep("");
    }
  };

  const handleSyncCloud = async () => {
    if (!cloudEnabled) return;
    setCloudSyncing(true);
    try {
      const { ok, data } = await postCloudAction("sync");
      if (ok) setCloudStatus({ type: "success", message: "Synced successfully" });
      else setCloudStatus({ type: "error", message: data.error });
    } catch (error) {
      setCloudStatus({ type: "error", message: error.message });
    } finally {
      setCloudSyncing(false);
    }
  };

  const handleSaveCloudUrl = async () => {
    const trimmed = cloudUrlInput.trim().replace(/\/v1\/?$/, "").replace(/\/+$/, "");
    if (!trimmed) return;
    setCloudUrlSaving(true);
    setSetupStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloudUrl: trimmed }),
      });
      if (res.ok) {
        setCloudUrl(trimmed);
        setCloudUrlInput(trimmed);
        setSetupStatus({ type: "success", message: "Worker URL saved" });
      } else {
        setSetupStatus({ type: "error", message: "Failed to save Worker URL" });
      }
    } catch (error) {
      setSetupStatus({ type: "error", message: error.message });
    } finally {
      setCloudUrlSaving(false);
    }
  };

  const handleCheckCloud = async () => {
    if (!cloudUrl) return;
    setCloudSyncing(true);
    setSetupStatus(null);
    try {
      const { ok, data } = await postCloudAction("check", 8000);
      if (ok) setSetupStatus({ type: "success", message: data.message || "Worker is running" });
      else setSetupStatus({ type: "error", message: data.error || "Check failed" });
    } catch {
      setSetupStatus({ type: "error", message: "Cannot reach worker" });
    } finally {
      setCloudSyncing(false);
    }
  };
  ========== END CLOUD FUNCTIONS ========== */

  const loadSettings = async () => {
    try {
      const [settingsRes, tunnelRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/tunnel/status")
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setRequireApiKey(data.requireApiKey || false);
      }
      if (tunnelRes.ok) {
        const data = await tunnelRes.json();
        setTunnelEnabled(data.enabled || false);
        setTunnelUrl(data.tunnelUrl || "");
        setTunnelShortId(data.shortId || "");
      }
    } catch (error) {
      console.log("Error loading settings:", error);
    }
  };

  const handleRequireApiKey = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireApiKey: value }),
      });
      if (res.ok) setRequireApiKey(value);
    } catch (error) {
      console.log("Error updating requireApiKey:", error);
    }
  };

  const fetchData = async () => {
    try {
      const [keysRes, modelsRes, nodesRes, providersRes] = await Promise.all([
        fetch("/api/keys"),
        fetch("/api/v1/models"),
        fetch("/api/provider-nodes"),
        fetch("/api/providers"),
      ]);

      const keysData = await keysRes.json();
      if (keysRes.ok) {
        setKeys(keysData.keys || []);
      }

      let allModelIds = [];

      const modelsData = await modelsRes.json().catch(() => ({}));
      if (modelsRes.ok && Array.isArray(modelsData.data)) {
        const models = modelsData.data
          .map((item) => String(item?.id || "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));

        allModelIds = models;
      }

      const providersData = await providersRes.json().catch(() => ({}));
      if (providersRes.ok && Array.isArray(providersData.connections)) {
        const compatibleConnections = providersData.connections.filter((conn) => {
          const providerId = String(conn?.provider || "");
          return (
            conn?.authType === "apikey" &&
            conn?.isActive !== false &&
            (providerId.startsWith(OPENAI_COMPATIBLE_PREFIX) || providerId.startsWith(ANTHROPIC_COMPATIBLE_PREFIX))
          );
        });

        if (compatibleConnections.length > 0) {
          const dynamicResults = await Promise.allSettled(
            compatibleConnections.map(async (conn) => {
              const response = await fetch(`/api/providers/${conn.id}/models`);
              if (!response.ok) {
                return { conn, models: [] };
              }
              const data = await response.json().catch(() => ({}));
              return { conn, models: Array.isArray(data.models) ? data.models : [] };
            })
          );

          const dynamicModelIds = [];
          for (const result of dynamicResults) {
            if (result.status !== "fulfilled") continue;

            const { conn, models } = result.value;
            const prefix = String(conn?.providerSpecificData?.prefix || "")
              .trim()
              .replace(/\/+$/, "");

            for (const model of models) {
              const rawId = String(model?.id || model?.model || model?.name || "").trim();
              if (!rawId) continue;

              if (!prefix) {
                dynamicModelIds.push(rawId);
                continue;
              }

              if (rawId.startsWith(`${prefix}/`)) {
                dynamicModelIds.push(rawId);
              } else {
                dynamicModelIds.push(`${prefix}/${rawId.replace(/^\/+/, "")}`);
              }
            }
          }

          if (dynamicModelIds.length > 0) {
            allModelIds = Array.from(new Set([...allModelIds, ...dynamicModelIds])).sort((a, b) =>
              a.localeCompare(b)
            );
          }
        }
      }

      if (allModelIds.length > 0) {
        setAvailableModelOptions(allModelIds);
      } else {
        setAvailableModelOptions([]);
      }

      const modelPrefixes = Array.from(
        new Set(
          allModelIds
            .filter((id) => id.includes("/"))
            .map((id) => `${id.split("/")[0]}/`)
        )
      ).sort((a, b) => a.localeCompare(b));

      let nodePrefixes = [];
      const nodesData = await nodesRes.json().catch(() => ({}));
      if (nodesRes.ok && Array.isArray(nodesData.nodes)) {
        nodePrefixes = nodesData.nodes
          .map((node) => normalizePrefixValue(node?.prefix))
          .filter(Boolean);
      }

      const mergedPrefixes = Array.from(new Set([...modelPrefixes, ...nodePrefixes])).sort((a, b) =>
        a.localeCompare(b)
      );
      setAvailablePrefixOptions(mergedPrefixes);
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPolicy = async (keyId) => {
    if (!keyId) {
      resetPolicyForm();
      return;
    }

    setPolicyLoading(true);
    setPolicyStatus(null);
    try {
      const res = await fetch(`/api/keys/${keyId}/policy`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load key policy");
      }

      const policy = data.policy;
      if (!policy) {
        resetPolicyForm();
        return;
      }

      setPolicyForm({
        expiresAt: toLocalDateTime(policy.expiresAt),
        allowedPrefixes: normalizeArrayField(policy.allowedPrefixes),
        allowedModels: normalizeArrayField(policy.allowedModels),
        allowedPaths: Array.isArray(policy.allowedPaths) ? policy.allowedPaths : [],
      });
    } catch (error) {
      setPolicyStatus({ type: "error", message: error.message || "Failed to load key policy" });
    } finally {
      setPolicyLoading(false);
    }
  };

  const savePolicy = async () => {
    if (!policyKeyId) return;

    setPolicySaving(true);
    setPolicyStatus(null);
    try {
      const payload = {
        expiresAt: policyForm.expiresAt ? new Date(policyForm.expiresAt).toISOString() : null,
        allowedPaths: policyForm.allowedPaths,
        allowedPrefixes: normalizeArrayField(policyForm.allowedPrefixes),
        allowedModels: normalizeArrayField(policyForm.allowedModels),
      };

      const res = await fetch(`/api/keys/${policyKeyId}/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save key policy");
      }

      setPolicyStatus({ type: "success", message: "Key policy saved" });
      await loadPolicy(policyKeyId);
    } catch (error) {
      setPolicyStatus({ type: "error", message: error.message || "Failed to save key policy" });
    } finally {
      setPolicySaving(false);
    }
  };

  const clearPolicy = async () => {
    if (!policyKeyId) return;

    const confirmed = confirm("Clear policy for this key? It will return to full access.");
    if (!confirmed) return;

    setPolicySaving(true);
    setPolicyStatus(null);
    try {
      const res = await fetch(`/api/keys/${policyKeyId}/policy`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to clear key policy");
      }

      resetPolicyForm();
      setPolicyStatus({ type: "success", message: "Key policy cleared" });
    } catch (error) {
      setPolicyStatus({ type: "error", message: error.message || "Failed to clear key policy" });
    } finally {
      setPolicySaving(false);
    }
  };

  const togglePolicyPath = (path) => {
    setPolicyForm((prev) => {
      const exists = prev.allowedPaths.includes(path);
      return {
        ...prev,
        allowedPaths: exists
          ? prev.allowedPaths.filter((item) => item !== path)
          : [...prev.allowedPaths, path],
      };
    });
  };

  const selectAllPaths = () => {
    setPolicyForm((prev) => ({
      ...prev,
      allowedPaths: [...POLICY_PATH_OPTIONS],
    }));
  };

  const clearAllPaths = () => {
    setPolicyForm((prev) => ({
      ...prev,
      allowedPaths: [],
    }));
  };

  const togglePolicyPrefix = (prefix) => {
    setPolicyForm((prev) => {
      const exists = prev.allowedPrefixes.includes(prefix);
      return {
        ...prev,
        allowedPrefixes: exists
          ? prev.allowedPrefixes.filter((item) => item !== prefix)
          : [...prev.allowedPrefixes, prefix],
      };
    });
  };

  const togglePolicyModel = (model) => {
    setPolicyForm((prev) => {
      const exists = prev.allowedModels.includes(model);
      return {
        ...prev,
        allowedModels: exists
          ? prev.allowedModels.filter((item) => item !== model)
          : [...prev.allowedModels, model],
      };
    });
  };

  const selectAllPrefixes = () => {
    setPolicyForm((prev) => ({
      ...prev,
      allowedPrefixes: [...mergedPrefixOptions],
    }));
  };

  const clearAllPrefixes = () => {
    setPolicyForm((prev) => ({
      ...prev,
      allowedPrefixes: [],
    }));
  };

  const addCustomPrefix = () => {
    const normalized = normalizePrefixValue(customPrefixInput);
    if (!normalized) return;
    setPolicyForm((prev) => {
      if (prev.allowedPrefixes.includes(normalized)) return prev;
      return {
        ...prev,
        allowedPrefixes: [...prev.allowedPrefixes, normalized],
      };
    });
    setCustomPrefixInput("");
  };

  const selectFilteredModels = () => {
    if (filteredModelOptions.length === 0) return;
    setPolicyForm((prev) => ({
      ...prev,
      allowedModels: Array.from(new Set([...prev.allowedModels, ...filteredModelOptions])),
    }));
  };

  const clearAllModels = () => {
    setPolicyForm((prev) => ({
      ...prev,
      allowedModels: [],
    }));
  };

  const addCustomModel = () => {
    const normalized = normalizeModelValue(customModelInput);
    if (!normalized) return;
    setPolicyForm((prev) => {
      if (prev.allowedModels.includes(normalized)) return prev;
      return {
        ...prev,
        allowedModels: [...prev.allowedModels, normalized],
      };
    });
    setCustomModelInput("");
  };

  const handleEnableTunnel = async () => {
    setShowEnableModal(false);
    setTunnelLoading(true);
    setTunnelStatus(null);
    setTunnelProgress("Connecting to server...");

    const progressSteps = [
      { delay: 2000, msg: "Creating tunnel..." },
      { delay: 5000, msg: "Starting cloudflared..." },
      { delay: 15000, msg: "Establishing connections..." },
      { delay: 30000, msg: "Waiting for tunnel ready..." },
    ];
    const timers = progressSteps.map(({ delay, msg }) =>
      setTimeout(() => setTunnelProgress(msg), delay)
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TUNNEL_ACTION_TIMEOUT_MS);
      const res = await fetch("/api/tunnel/enable", {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      timers.forEach(clearTimeout);
      const data = await res.json();
      if (res.ok) {
        setTunnelEnabled(true);
        setTunnelUrl(data.tunnelUrl || "");
        setTunnelShortId(data.shortId || "");
        setTunnelStatus({ type: "success", message: "Tunnel connected!" });
      } else {
        setTunnelStatus({ type: "error", message: data.error || "Failed to enable tunnel" });
      }
    } catch (error) {
      timers.forEach(clearTimeout);
      const msg = error?.name === "AbortError" ? "Tunnel creation timed out" : error.message;
      setTunnelStatus({ type: "error", message: msg });
    } finally {
      setTunnelLoading(false);
      setTunnelProgress("");
    }
  };

  const handleDisableTunnel = async () => {
    setTunnelLoading(true);
    setTunnelStatus(null);
    try {
      const res = await fetch("/api/tunnel/disable", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTunnelEnabled(false);
        setTunnelUrl("");
        setTunnelStatus({ type: "success", message: "Tunnel disabled" });
        setShowDisableModal(false);
      } else {
        setTunnelStatus({ type: "error", message: data.error || "Failed to disable tunnel" });
      }
    } catch (error) {
      setTunnelStatus({ type: "error", message: error.message });
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();

      if (res.ok) {
        setCreatedKey(data.key);
        await fetchData();
        setNewKeyName("");
        setShowAddModal(false);
      }
    } catch (error) {
      console.log("Error creating key:", error);
    }
  };

  const handleDeleteKey = async (id) => {
    if (!confirm("Delete this API key?")) return;

    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys(keys.filter((k) => k.id !== id));
      }
    } catch (error) {
      console.log("Error deleting key:", error);
    }
  };

  const handleToggleKey = async (id, isActive) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        setKeys(prev => prev.map(k => k.id === id ? { ...k, isActive } : k));
      }
    } catch (error) {
      console.log("Error toggling key:", error);
    }
  };

  const [baseUrl, setBaseUrl] = useState("/v1");

  // Hydration fix: Only access window on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(`${window.location.origin}/v1`);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const currentEndpoint = tunnelEnabled && tunnelUrl ? `${tunnelUrl}/v1` : baseUrl;

  return (
    <div className="flex flex-col gap-8">
      {/* Endpoint Card */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">API Endpoint</h2>
            <p className="text-sm text-text-muted">
              {tunnelEnabled ? "Using Tunnel" : "Using Local Server"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tunnelEnabled ? (
              <Button
                size="sm"
                variant="secondary"
                icon="cloud_off"
                onClick={() => setShowDisableModal(true)}
                disabled={tunnelLoading}
                className="bg-red-500/10! text-red-500! hover:bg-red-500/20! border-red-500/30!"
              >
                Disable Tunnel
              </Button>
            ) : (
              <Button
                variant="primary"
                icon="cloud_upload"
                onClick={() => setShowEnableModal(true)}
                disabled={tunnelLoading}
                className="bg-linear-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600"
              >
                {tunnelLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    {tunnelProgress || "Creating tunnel..."}
                  </span>
                ) : "Enable Tunnel"}
              </Button>
            )}
          </div>
        </div>

        {/* Endpoint URL */}
        <div className="flex gap-2">
          <Input 
            value={currentEndpoint} 
            readOnly 
            className={`flex-1 font-mono text-sm ${tunnelEnabled ? "animate-border-glow" : ""}`}
          />
          <Button
            variant="secondary"
            icon={copied === "endpoint_url" ? "check" : "content_copy"}
            onClick={() => copy(currentEndpoint, "endpoint_url")}
          >
            {copied === "endpoint_url" ? "Copied!" : "Copy"}
          </Button>
        </div>

        {/* Tunnel Status */}
        {tunnelStatus && (
          <div className={`mt-3 p-2 rounded text-sm ${
            tunnelStatus.type === "success" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
            tunnelStatus.type === "warning" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" :
            "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}>
            {tunnelStatus.message}
          </div>
        )}
      </Card>

      {/* API Keys */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">API Keys</h2>
          <Button icon="add" onClick={() => setShowAddModal(true)}>
            Create Key
          </Button>
        </div>

        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
          <div>
            <p className="font-medium">Require API key</p>
            <p className="text-sm text-text-muted">
              Requests without a valid key will be rejected
            </p>
          </div>
          <Toggle
            checked={requireApiKey}
            onChange={() => handleRequireApiKey(!requireApiKey)}
          />
        </div>

        {keys.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <span className="material-symbols-outlined text-[32px]">vpn_key</span>
            </div>
            <p className="text-text-main font-medium mb-1">No API keys yet</p>
            <p className="text-sm text-text-muted mb-4">Create your first API key to get started</p>
            <Button icon="add" onClick={() => setShowAddModal(true)}>
              Create Key
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {keys.map((key) => (
              <div
                key={key.id}
                className={`group flex items-center justify-between py-3 border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0 ${key.isActive === false ? "opacity-60" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{key.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-text-muted font-mono">{key.key}</code>
                    <button
                      onClick={() => copy(key.key, key.id)}
                      className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {copied === key.id ? "check" : "content_copy"}
                      </span>
                    </button>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                  </p>
                  {key.isActive === false && (
                    <p className="text-xs text-orange-500 mt-1">Paused</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Toggle
                    size="sm"
                    checked={key.isActive ?? true}
                    onChange={(checked) => {
                      if (key.isActive && !checked) {
                        if (confirm(`Pause API key "${key.name}"?\n\nThis key will stop working immediately but can be resumed later.`)) {
                          handleToggleKey(key.id, checked);
                        }
                      } else {
                        handleToggleKey(key.id, checked);
                      }
                    }}
                    title={key.isActive ? "Pause key" : "Resume key"}
                  />
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="p-2 hover:bg-red-500/10 rounded text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Advanced Key Policy</h2>
            <p className="text-sm text-text-muted">Scope API keys by endpoint, prefix, model, and expiry</p>
          </div>
        </div>

        {keys.length === 0 ? (
          <p className="text-sm text-text-muted">Create an API key first to configure policy.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Select Key</label>
                <select
                  value={policyKeyId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setPolicyKeyId(nextId);
                    loadPolicy(nextId);
                  }}
                  className="w-full py-2 px-3 text-sm text-text-main bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md"
                >
                  <option value="">Choose API key</option>
                  {keys.map((key) => (
                    <option key={key.id} value={key.id}>{key.name}</option>
                  ))}
                </select>
              </div>

              <Input
                type="datetime-local"
                label="Expires At"
                value={policyForm.expiresAt}
                onChange={(e) => setPolicyForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                disabled={!policyKeyId || policyLoading || policySaving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Allowed Prefixes</p>
                <p className="text-xs text-text-muted">{policyForm.allowedPrefixes.length} selected</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectAllPrefixes}
                  disabled={!policyKeyId || policyLoading || policySaving || mergedPrefixOptions.length === 0}
                >
                  Select All Prefixes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearAllPrefixes}
                  disabled={!policyKeyId || policyLoading || policySaving || policyForm.allowedPrefixes.length === 0}
                >
                  Clear Prefixes
                </Button>
              </div>

              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Add custom prefix (e.g. myprovider/)"
                  value={customPrefixInput}
                  onChange={(e) => setCustomPrefixInput(e.target.value)}
                  disabled={!policyKeyId || policyLoading || policySaving}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={addCustomPrefix}
                  disabled={!policyKeyId || policyLoading || policySaving || !normalizePrefixValue(customPrefixInput)}
                >
                  Add
                </Button>
              </div>

              {mergedPrefixOptions.length === 0 ? (
                <p className="text-sm text-text-muted">No prefix options available.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {mergedPrefixOptions.map((prefix) => {
                    const selected = policyForm.allowedPrefixes.includes(prefix);
                    return (
                      <button
                        key={prefix}
                        type="button"
                        onClick={() => togglePolicyPrefix(prefix)}
                        disabled={!policyKeyId || policyLoading || policySaving}
                        className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                          selected
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "border-black/10 dark:border-white/10 text-text-muted hover:text-text-main"
                        }`}
                      >
                        {prefix}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Allowed Models</p>
                <p className="text-xs text-text-muted">{policyForm.allowedModels.length} selected</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectFilteredModels}
                  disabled={!policyKeyId || policyLoading || policySaving || filteredModelOptions.length === 0}
                >
                  Select Visible Models
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearAllModels}
                  disabled={!policyKeyId || policyLoading || policySaving || policyForm.allowedModels.length === 0}
                >
                  Clear Models
                </Button>
              </div>

              <Input
                placeholder="Search and select models"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                disabled={!policyKeyId || policyLoading || policySaving}
                hint={`${filteredModelOptions.length} models shown`}
              />

              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Add custom exact model"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  disabled={!policyKeyId || policyLoading || policySaving}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={addCustomModel}
                  disabled={!policyKeyId || policyLoading || policySaving || !normalizeModelValue(customModelInput)}
                >
                  Add
                </Button>
              </div>

              <div className="max-h-56 overflow-auto rounded-md border border-black/10 dark:border-white/10 p-2 space-y-1">
                {filteredModelOptions.length === 0 ? (
                  <p className="text-xs text-text-muted px-1 py-1">No models match your search.</p>
                ) : (
                  filteredModelOptions.map((model) => (
                    <label
                      key={model}
                      className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={policyForm.allowedModels.includes(model)}
                        onChange={() => togglePolicyModel(model)}
                        disabled={!policyKeyId || policyLoading || policySaving}
                      />
                      <span className="font-mono text-xs break-all">{model}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Allowed Paths</p>
                <p className="text-xs text-text-muted">{policyForm.allowedPaths.length} selected</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectAllPaths}
                  disabled={!policyKeyId || policyLoading || policySaving}
                >
                  Select All Paths
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearAllPaths}
                  disabled={!policyKeyId || policyLoading || policySaving || policyForm.allowedPaths.length === 0}
                >
                  Clear Paths
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {POLICY_PATH_OPTIONS.map((path) => (
                  <label
                    key={path}
                    className="flex items-center gap-2 text-sm p-2 rounded border border-black/10 dark:border-white/10"
                  >
                    <input
                      type="checkbox"
                      checked={policyForm.allowedPaths.includes(path)}
                      onChange={() => togglePolicyPath(path)}
                      disabled={!policyKeyId || policyLoading || policySaving}
                    />
                    <span className="font-mono text-xs">{path}</span>
                  </label>
                ))}
              </div>
            </div>

            {policyStatus && (
              <p className={`text-sm ${policyStatus.type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                {policyStatus.message}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={savePolicy}
                loading={policySaving}
                disabled={!policyKeyId || policyLoading}
              >
                Save Policy
              </Button>
              <Button
                variant="secondary"
                onClick={clearPolicy}
                disabled={!policyKeyId || policyLoading || policySaving}
              >
                Clear Policy
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* CLOUD MODALS — COMMENTED OUT (replaced by Tunnel) */}
      {/* Setup Cloud Modal — removed */}
      {/* Cloud Enable Modal — removed */}

      {/* Add Key Modal */}
      <Modal
        isOpen={showAddModal}
        title="Create API Key"
        onClose={() => {
          setShowAddModal(false);
          setNewKeyName("");
        }}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Production Key"
          />
          <div className="flex gap-2">
            <Button onClick={handleCreateKey} fullWidth disabled={!newKeyName.trim()}>
              Create
            </Button>
            <Button
              onClick={() => {
                setShowAddModal(false);
                setNewKeyName("");
              }}
              variant="ghost"
              fullWidth
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Created Key Modal */}
      <Modal
        isOpen={!!createdKey}
        title="API Key Created"
        onClose={() => setCreatedKey(null)}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2 font-medium">
              Save this key now!
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This is the only time you will see this key. Store it securely.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={createdKey || ""}
              readOnly
              className="flex-1 font-mono text-sm"
            />
            <Button
              variant="secondary"
              icon={copied === "created_key" ? "check" : "content_copy"}
              onClick={() => copy(createdKey, "created_key")}
            >
              {copied === "created_key" ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button onClick={() => setCreatedKey(null)} fullWidth>
            Done
          </Button>
        </div>
      </Modal>

      {/* Enable Tunnel Modal */}
      <Modal
        isOpen={showEnableModal}
        title="Enable Tunnel"
        onClose={() => setShowEnableModal(false)}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">cloud_upload</span>
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                  Cloudflare Tunnel
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Expose your local 9Router to the internet. No port forwarding, no static IP needed. Share endpoint URL with your team or use it in Cursor, Cline, and other AI tools from anywhere.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {TUNNEL_BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex flex-col items-center text-center p-3 rounded-lg bg-sidebar/50">
                <span className="material-symbols-outlined text-xl text-primary mb-1">{benefit.icon}</span>
                <p className="text-xs font-semibold">{benefit.title}</p>
                <p className="text-xs text-text-muted">{benefit.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-text-muted">
            Requires outbound port 7844 (TCP/UDP). Connection may take 10-30s.
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handleEnableTunnel}
              fullWidth
              className="bg-linear-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600 text-white!"
            >
              Start Tunnel
            </Button>
            <Button
              onClick={() => setShowEnableModal(false)}
              variant="ghost"
              fullWidth
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Disable Tunnel Modal */}
      <Modal
        isOpen={showDisableModal}
        title="Disable Tunnel"
        onClose={() => !tunnelLoading && setShowDisableModal(false)}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-red-600 dark:text-red-400">warning</span>
              <div>
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
                  Warning
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  The tunnel will be disconnected. Remote access will stop working.
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-text-muted">Are you sure you want to disable the tunnel?</p>

          <div className="flex gap-2">
            <Button
              onClick={handleDisableTunnel}
              fullWidth
              disabled={tunnelLoading}
              className="bg-red-500! hover:bg-red-600! text-white!"
            >
              {tunnelLoading ? (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  Disabling...
                </span>
              ) : "Disable Tunnel"}
            </Button>
            <Button
              onClick={() => setShowDisableModal(false)}
              variant="ghost"
              fullWidth
              disabled={tunnelLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

APIPageClient.propTypes = {
  machineId: PropTypes.string.isRequired,
};
