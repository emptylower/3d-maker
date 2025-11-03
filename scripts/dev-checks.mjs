import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";

const log = (...args) => console.log("[dev-checks]", ...args);
const fail = (...args) => console.error("[dev-checks]", ...args);

function loadEnv() {
  const candidates = [
    ".env.local",
    ".env.development.local",
    ".env.development",
    ".env",
  ];
  for (const fname of candidates) {
    const fpath = path.resolve(process.cwd(), fname);
    if (fs.existsSync(fpath)) {
      try {
        const content = fs.readFileSync(fpath, "utf8");
        for (const rawLine of content.split(/\r?\n/)) {
          const line = rawLine.trim();
          if (!line || line.startsWith("#")) continue;
          const idx = line.indexOf("=");
          if (idx === -1) continue;
          const key = line.slice(0, idx).trim();
          let value = line.slice(idx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!(key in process.env)) {
            process.env[key] = value;
          }
        }
        log(`Loaded env from ${fname}`);
        return;
      } catch (e) {
        fail(`Failed to load ${fname}:`, e?.message || e);
      }
    }
  }
}

async function checkSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    fail("Supabase env missing. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON key).");
    return false;
  }

  log("Connecting Supabase =>", supabaseUrl);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const uuid = (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    (await import("node:crypto")).randomUUID();
  const email = `dev-check-${Date.now()}@example.com`;
  const now = new Date().toISOString();

  try {
    // insert -> select -> delete
    const insertRes = await supabase
      .from("users")
      .insert({
        uuid,
        email,
        created_at: now,
        signin_type: "dev-check",
        signin_ip: "127.0.0.1",
        signin_provider: "dev-check",
        invite_code: "",
        invited_by: "",
        is_affiliate: false,
      })
      .select("uuid")
      .single();

    if (insertRes.error) {
      fail("Supabase insert failed:", insertRes.error.message);
      fail("Hint: provide SUPABASE_SERVICE_ROLE_KEY or relax RLS for 'users'.");
      return false;
    }

    const selectRes = await supabase
      .from("users")
      .select("uuid")
      .eq("uuid", uuid)
      .single();

    if (selectRes.error) {
      fail("Supabase select failed:", selectRes.error.message);
      return false;
    }

    const deleteRes = await supabase.from("users").delete().eq("uuid", uuid);
    if (deleteRes.error) {
      fail("Supabase cleanup failed:", deleteRes.error.message);
      return false;
    }

    log("Supabase OK");
    return true;
  } catch (e) {
    fail("Supabase check error:", e?.message || e);
    return false;
  }
}

async function checkStorage() {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const region = process.env.STORAGE_REGION || "auto";
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;
  const bucket = process.env.STORAGE_BUCKET;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    fail("Storage env missing. Need STORAGE_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY/BUCKET.");
    return false;
  }

  log("Connecting Storage (R2/S3 compat) =>", endpoint);

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const key = `dev-checks/test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  const body = Buffer.from(`dev-check ok @ ${new Date().toISOString()}\n`);

  try {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "text/plain" }));
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    log("Storage OK");
    return true;
  } catch (e) {
    fail("Storage check error:", e?.message || e);
    return false;
  }
}

(async () => {
  loadEnv();
  const results = await Promise.all([checkSupabase(), checkStorage()]);
  const dbOk = results[0];
  const storageOk = results[1];
  if (dbOk && storageOk) {
    log("All checks passed.");
    process.exit(0);
  } else {
    fail(`Checks failed: DB=${dbOk}, Storage=${storageOk}`);
    process.exit(1);
  }
})();
