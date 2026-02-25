import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import {
  getProviderAlias,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
} from "@/shared/constants/providers";
import {
  getProviderConnections,
  getCombos,
  getApiKeyByValue,
  getApiKeyPolicy,
} from "@/lib/localDb";
import { extractApiKey, enforceApiKeyPolicy, isValidApiKey } from "@/sse/services/auth";
import { evaluateApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";

const COMPATIBLE_MODELS_CACHE_TTL_MS = 60 * 1000;
const compatibleModelsCache = new Map();

function parseOpenAIStyleModels(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.models)) return data.models;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function stripKnownPrefix(modelId, knownPrefixes = []) {
  const value = String(modelId || "").trim();
  if (!value) return "";
  for (const prefix of knownPrefixes) {
    if (!prefix) continue;
    if (value.startsWith(`${prefix}/`)) {
      return value.slice(prefix.length + 1);
    }
  }
  return value;
}

async function fetchCompatibleModelIds(providerId, connection) {
  const baseUrlRaw = connection?.providerSpecificData?.baseUrl;
  const apiKey = connection?.apiKey;
  if (!baseUrlRaw || !apiKey) {
    return [];
  }

  const cacheKey = `${connection?.id || "unknown"}:${connection?.updatedAt || ""}:${baseUrlRaw}`;
  const cached = compatibleModelsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.modelIds;
  }

  let baseUrl = String(baseUrlRaw).trim().replace(/\/$/, "");
  if (isAnthropicCompatibleProvider(providerId) && baseUrl.endsWith("/messages")) {
    baseUrl = baseUrl.slice(0, -9);
  }

  const response = await fetch(`${baseUrl}/models`, {
    method: "GET",
    headers: isAnthropicCompatibleProvider(providerId)
      ? {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          Authorization: `Bearer ${apiKey}`,
        }
      : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json().catch(() => ({}));
  const models = parseOpenAIStyleModels(data);
  const modelIds = models
    .map((item) => String(item?.id || item?.model || item?.name || "").trim())
    .filter(Boolean);

  compatibleModelsCache.set(cacheKey, {
    modelIds,
    expiresAt: Date.now() + COMPATIBLE_MODELS_CACHE_TTL_MS,
  });

  return modelIds;
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

/**
 * GET /v1/models - OpenAI compatible models list
 * Returns models from all active providers and combos in OpenAI format
 */
export async function GET(request) {
  try {
    let apiKeyPolicy = null;
    const apiKey = extractApiKey(request);
    if (apiKey) {
      const valid = await isValidApiKey(apiKey);
      if (!valid) {
        return Response.json({ error: { message: "Invalid API key", type: "auth_error" } }, { status: 401 });
      }

      const policy = await enforceApiKeyPolicy(apiKey, {
        path: "/v1/models",
      });
      if (!policy.allowed) {
        return Response.json({ error: { message: policy.reason || "API key policy violation", type: "forbidden" } }, { status: 403 });
      }

      const keyRecord = await getApiKeyByValue(apiKey);
      if (keyRecord) {
        apiKeyPolicy = await getApiKeyPolicy(keyRecord.id);
      }
    }

    // Get active provider connections
    let connections = [];
    try {
      connections = await getProviderConnections();
      // Filter to only active connections
      connections = connections.filter(c => c.isActive !== false);
    } catch (e) {
      // If database not available, return all models
      console.log("Could not fetch providers, returning all models");
    }

    // Get combos
    let combos = [];
    try {
      combos = await getCombos();
    } catch (e) {
      console.log("Could not fetch combos");
    }

    // Build first active connection per provider (connections already sorted by priority)
    const activeConnectionByProvider = new Map();
    for (const conn of connections) {
      if (!activeConnectionByProvider.has(conn.provider)) {
        activeConnectionByProvider.set(conn.provider, conn);
      }
    }

    // Collect models from active providers (or all if none active)
    const models = [];
    const timestamp = Math.floor(Date.now() / 1000);

    // Add combos first (they appear at the top)
    for (const combo of combos) {
      models.push({
        id: combo.name,
        object: "model",
        created: timestamp,
        owned_by: "combo",
        permission: [],
        root: combo.name,
        parent: null,
      });
    }

    const compatibleModelIdsByProvider = new Map();
    const compatibleEntries = Array.from(activeConnectionByProvider.entries()).filter(([providerId]) =>
      isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId)
    );

    if (compatibleEntries.length > 0) {
      await Promise.all(
        compatibleEntries.map(async ([providerId, conn]) => {
          try {
            const modelIds = await fetchCompatibleModelIds(providerId, conn);
            compatibleModelIdsByProvider.set(providerId, modelIds);
          } catch {
            compatibleModelIdsByProvider.set(providerId, []);
          }
        })
      );
    }

    // Add provider models
    if (connections.length === 0) {
      // DB unavailable or no active providers -> return all static models
      for (const [alias, providerModels] of Object.entries(PROVIDER_MODELS)) {
        for (const model of providerModels) {
          models.push({
            id: `${alias}/${model.id}`,
            object: "model",
            created: timestamp,
            owned_by: alias,
            permission: [],
            root: model.id,
            parent: null,
          });
        }
      }
    } else {
      for (const [providerId, conn] of activeConnectionByProvider.entries()) {
        const staticAlias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
        const outputAlias = conn?.providerSpecificData?.prefix || getProviderAlias(providerId) || staticAlias;
        const providerModels = PROVIDER_MODELS[staticAlias] || [];
        const enabledModels = conn?.providerSpecificData?.enabledModels;
        const compatibleModelIds = compatibleModelIdsByProvider.get(providerId) || [];
        const isCompatibleProvider =
          isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId);
        const hasExplicitEnabledModels =
          Array.isArray(enabledModels) && enabledModels.length > 0;

        // Default: if no explicit selection, all static models are active.
        // If explicit selection exists, expose exactly those model IDs (including non-static IDs).
        const rawModelIds = hasExplicitEnabledModels
          ? Array.from(
              new Set(
                enabledModels.filter(
                  (modelId) => typeof modelId === "string" && modelId.trim() !== "",
                ),
              ),
            )
          : isCompatibleProvider
            ? Array.from(new Set(compatibleModelIds))
          : providerModels.map((model) => model.id);

        const modelIds = Array.from(new Set(rawModelIds
          .map((modelId) => {
            return stripKnownPrefix(modelId, [outputAlias, staticAlias, providerId]);
          })
          .filter((modelId) => typeof modelId === "string" && modelId.trim() !== "")));

        for (const modelId of modelIds) {
          models.push({
            id: `${outputAlias}/${modelId}`,
            object: "model",
            created: timestamp,
            owned_by: outputAlias,
            permission: [],
            root: modelId,
            parent: null,
          });
        }
      }
    }

    const scopedModels = apiKeyPolicy
      ? models.filter((model) => evaluateApiKeyPolicy(apiKeyPolicy, {
          path: "/v1/models",
          model: model.id,
        }).allowed)
      : models;

    return Response.json({
      object: "list",
      data: scopedModels,
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.log("Error fetching models:", error);
    return Response.json(
      { error: { message: error.message, type: "server_error" } },
      { status: 500 }
    );
  }
}
