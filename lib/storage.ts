import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

interface StorageConfig {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

export function newStorage(config?: StorageConfig) {
  return new Storage(config);
}

export class Storage {
  private s3: S3Client;

  constructor(config?: StorageConfig) {
    this.s3 = new S3Client({
      endpoint: config?.endpoint || process.env.STORAGE_ENDPOINT || "",
      region: config?.region || process.env.STORAGE_REGION || "auto",
      credentials: {
        accessKeyId: config?.accessKey || process.env.STORAGE_ACCESS_KEY || "",
        secretAccessKey:
          config?.secretKey || process.env.STORAGE_SECRET_KEY || "",
      },
    });
  }

  async uploadFile({
    body,
    key,
    contentType,
    bucket,
    onProgress,
    disposition = "inline",
  }: {
    body: Buffer;
    key: string;
    contentType?: string;
    bucket?: string;
    onProgress?: (progress: number) => void;
    disposition?: "inline" | "attachment";
  }) {
    if (!bucket) {
      bucket = process.env.STORAGE_BUCKET || "";
    }

    if (!bucket) {
      throw new Error("Bucket is required");
    }

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentDisposition: disposition,
        ...(contentType && { ContentType: contentType }),
      },
    });

    if (onProgress) {
      upload.on("httpUploadProgress", (progress) => {
        const percentage =
          ((progress.loaded || 0) / (progress.total || 1)) * 100;
        onProgress(percentage);
      });
    }

    const res = await upload.done();

    return {
      location: res.Location,
      bucket: res.Bucket,
      key: res.Key,
      filename: res.Key?.split("/").pop(),
      url: process.env.STORAGE_DOMAIN
        ? `${process.env.STORAGE_DOMAIN}/${res.Key}`
        : res.Location,
    };
  }

  async downloadAndUpload({
    url,
    key,
    bucket,
    contentType,
    disposition = "inline",
  }: {
    url: string;
    key: string;
    bucket?: string;
    contentType?: string;
    disposition?: "inline" | "attachment";
  }) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No body in response");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return this.uploadFile({
      body: buffer,
      key,
      bucket,
      contentType,
      disposition,
    });
  }

  async getObjectStream({
    key,
    bucket,
  }: {
    key: string;
    bucket?: string;
  }) {
    if (!bucket) {
      bucket = process.env.STORAGE_BUCKET || "";
    }
    if (!bucket) {
      throw new Error("Bucket is required");
    }

    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const res: any = await (this.s3 as any).send(cmd);
    const body = res.Body; // Node.js Readable stream
    const contentType = res.ContentType as string | undefined;
    const contentLength = res.ContentLength as number | undefined;
    const lastModified = res.LastModified as Date | undefined;
    const etag = res.ETag as string | undefined;

    return { body, contentType, contentLength, lastModified, etag };
  }

  async getSignedUrl({
    key,
    bucket,
    expiresInSec,
  }: {
    key: string;
    bucket?: string;
    expiresInSec?: number;
  }) {
    if (!bucket) {
      bucket = process.env.STORAGE_BUCKET || "";
    }
    if (!bucket) {
      throw new Error("Bucket is required");
    }

    const ttl = Number(
      expiresInSec || process.env.STORAGE_SIGN_URL_TTL_SEC || 300
    );

    // 动态导入，避免在未安装 presigner 时影响其他路径
    let getSignedUrlFn: any;
    try {
      ({ getSignedUrl: getSignedUrlFn } = await import(
        "@aws-sdk/s3-request-presigner"
      ));
    } catch (e) {
      throw new Error(
        "MISSING_DEP: @aws-sdk/s3-request-presigner not installed for presigned mode"
      );
    }

    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrlFn(this.s3 as any, cmd as any, {
      expiresIn: ttl,
    });
    return { url, expiresIn: ttl };
  }
}
