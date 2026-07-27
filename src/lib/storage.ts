import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const required = ["S3_ENDPOINT", "S3_REGION", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"] as const;

function config() {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Storage is not configured: ${missing.join(", ")}.`);
  return { endpoint: process.env.S3_ENDPOINT!, region: process.env.S3_REGION!, accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY!, bucket: process.env.S3_BUCKET! };
}

let initialized: Promise<void> | undefined;

function client() {
  const settings = config();
  return new S3Client({ endpoint: settings.endpoint, region: settings.region, forcePathStyle: true, credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey } });
}

async function ensureBucket() {
  if (!initialized) {
    initialized = (async () => {
    const s3 = client();
    const { bucket } = config();
    try { await s3.send(new HeadBucketCommand({ Bucket: bucket })); }
    catch { await s3.send(new CreateBucketCommand({ Bucket: bucket })); }
    })().catch((error) => {
      initialized = undefined;
      throw error;
    });
  }
  return initialized;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "attachment";
}

export async function uploadAttachment(reportId: string, file: File) {
  await ensureBucket();
  const { bucket } = config();
  const key = `reports/${reportId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  await client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type, ContentLength: file.size }));
  return key;
}

export async function downloadAttachment(key: string) {
  await ensureBucket();
  const { bucket } = config();
  return client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}
