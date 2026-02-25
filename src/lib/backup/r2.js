import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const DEFAULT_PREFIX = "9router/backups/";
const DEFAULT_RETENTION_COUNT = 30;

function toNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value.trim();
}

function getConfig() {
  const endpoint = process.env.R2_ENDPOINT || `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
  const bucket = requireEnv("R2_BUCKET");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const prefixRaw = process.env.R2_PREFIX || DEFAULT_PREFIX;
  const prefix = prefixRaw.endsWith("/") ? prefixRaw : `${prefixRaw}/`;
  const retention = toNumber(process.env.R2_RETENTION_COUNT, DEFAULT_RETENTION_COUNT);

  return { endpoint, bucket, accessKeyId, secretAccessKey, prefix, retention };
}

function getClient(config) {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function buildBackupKey(prefix) {
  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
  return `${prefix}db-backup-${timestamp}.enc.json`;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function mapBackupObject(object, prefix) {
  return {
    key: object.Key,
    name: String(object.Key || "").replace(prefix, ""),
    size: object.Size || 0,
    lastModified: object.LastModified ? new Date(object.LastModified).toISOString() : null,
  };
}

async function listRawBackups(client, config) {
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: config.prefix,
      MaxKeys: 1000,
    })
  );

  const objects = (result.Contents || [])
    .filter((item) => item.Key && item.Key.startsWith(config.prefix))
    .sort((a, b) => new Date(b.LastModified || 0) - new Date(a.LastModified || 0));

  return objects;
}

export async function uploadEncryptedBackup(buffer) {
  const config = getConfig();
  const client = getClient(config);
  const key = buildBackupKey(config.prefix);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: "application/json",
      Metadata: {
        app: "9router",
        format: "encrypted-db-backup",
      },
    })
  );

  const allBackups = await listRawBackups(client, config);
  if (allBackups.length > config.retention) {
    const deleteCandidates = allBackups.slice(config.retention).map((item) => ({ Key: item.Key }));
    if (deleteCandidates.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: {
            Objects: deleteCandidates,
            Quiet: true,
          },
        })
      );
    }
  }

  return { key, retention: config.retention };
}

export async function listEncryptedBackups() {
  const config = getConfig();
  const client = getClient(config);
  const objects = await listRawBackups(client, config);

  return objects.map((item) => mapBackupObject(item, config.prefix));
}

export async function downloadEncryptedBackup(key) {
  const config = getConfig();
  const client = getClient(config);
  const safeKey = String(key || "").trim();
  if (!safeKey) {
    throw new Error("Backup key is required");
  }

  const backupKey = safeKey.startsWith(config.prefix) ? safeKey : `${config.prefix}${safeKey}`;
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: backupKey,
    })
  );

  if (!response.Body) {
    throw new Error("Backup file is empty");
  }

  const buffer = await streamToBuffer(response.Body);
  return { key: backupKey, buffer };
}
