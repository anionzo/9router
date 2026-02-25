function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }

  return result;
}

export function normalizePolicyPath(path) {
  const text = String(path || "").trim();
  if (!text) return null;
  const withLeadingSlash = text.startsWith("/") ? text : `/${text}`;

  if (withLeadingSlash === "/api/v1") {
    return "/v1";
  }

  if (withLeadingSlash.startsWith("/api/v1/")) {
    return `/v1/${withLeadingSlash.slice("/api/v1/".length)}`;
  }

  return withLeadingSlash;
}

function normalizePrefix(prefix) {
  const text = String(prefix || "").trim();
  if (!text) return null;
  const clean = text.replace(/^\/+|\/+$/g, "");
  if (!clean) return null;
  return `${clean}/`;
}

export function normalizeApiKeyPolicyInput(input = {}) {
  const expiresAtRaw = input.expiresAt;
  let expiresAt = null;

  if (expiresAtRaw) {
    const timestamp = Date.parse(expiresAtRaw);
    if (!Number.isFinite(timestamp)) {
      throw new Error("Invalid expiresAt value");
    }
    expiresAt = new Date(timestamp).toISOString();
  }

  const allowedPaths = uniqueStrings(input.allowedPaths)
    .map((path) => normalizePolicyPath(path))
    .filter(Boolean);

  const allowedPrefixes = uniqueStrings(input.allowedPrefixes)
    .map((prefix) => normalizePrefix(prefix))
    .filter(Boolean);

  const allowedModels = uniqueStrings(input.allowedModels);

  return {
    expiresAt,
    allowedPaths,
    allowedPrefixes,
    allowedModels,
  };
}

export function isApiKeyPolicyEmpty(policy) {
  if (!policy) return true;
  return (
    !policy.expiresAt &&
    (!Array.isArray(policy.allowedPaths) || policy.allowedPaths.length === 0) &&
    (!Array.isArray(policy.allowedPrefixes) || policy.allowedPrefixes.length === 0) &&
    (!Array.isArray(policy.allowedModels) || policy.allowedModels.length === 0)
  );
}

export function evaluateApiKeyPolicy(policy, { path = "", model = null } = {}) {
  if (!policy || isApiKeyPolicyEmpty(policy)) {
    return { allowed: true };
  }

  if (policy.expiresAt) {
    const expiresAtMs = Date.parse(policy.expiresAt);
    if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
      return { allowed: false, reason: "API key has expired" };
    }
  }

  const currentPath = normalizePolicyPath(path) || path;
  const allowedPaths = (Array.isArray(policy.allowedPaths) ? policy.allowedPaths : [])
    .map((item) => normalizePolicyPath(item))
    .filter(Boolean);
  if (allowedPaths.length > 0 && !allowedPaths.includes(currentPath)) {
    return { allowed: false, reason: `API key is not allowed for ${currentPath}` };
  }

  if (model) {
    const modelValue = String(model);
    const prefixes = Array.isArray(policy.allowedPrefixes) ? policy.allowedPrefixes : [];
    const models = Array.isArray(policy.allowedModels) ? policy.allowedModels : [];

    if (prefixes.length > 0 || models.length > 0) {
      const prefixMatched = prefixes.some((prefix) => modelValue.startsWith(prefix));
      const modelMatched = models.includes(modelValue);
      if (!prefixMatched && !modelMatched) {
        return { allowed: false, reason: `API key is not allowed for model ${modelValue}` };
      }
    }
  }

  return { allowed: true };
}
