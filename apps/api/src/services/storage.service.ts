import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageConfig {
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

export interface GeneratePresignedUploadOptions {
  storageKey: string;
  mimeType?: string;
  fileSize?: number;
  expiresInSeconds?: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresAt: Date;
  headers: Record<string, string>;
}

export class StorageService {
  private client: S3Client | null = null;
  private bucket: string;
  private isConfigured: boolean;

  constructor(config?: Partial<StorageConfig>, customClient?: S3Client) {
    if (customClient) {
      this.client = customClient;
      this.bucket = config?.bucket || process.env.S3_BUCKET || 'corpchat-attachments';
      this.isConfigured = true;
      return;
    }

    const endpoint = config?.endpoint || process.env.S3_ENDPOINT;
    const region = config?.region || process.env.S3_REGION || 'auto';
    const bucket = config?.bucket || process.env.S3_BUCKET || 'corpchat-attachments';
    const accessKeyId = config?.accessKeyId || process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY;
    const forcePathStyle = config?.forcePathStyle ?? (process.env.S3_FORCE_PATH_STYLE === 'true' || Boolean(endpoint));

    this.bucket = bucket;

    if (accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        endpoint: endpoint || undefined,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle,
      });
      this.isConfigured = true;
    } else {
      this.isConfigured = false;
    }
  }

  /**
   * Generates a pre-signed PUT URL for direct client upload with Server-Side Encryption (AES256)
   */
  async generatePresignedUploadUrl(
    options: GeneratePresignedUploadOptions
  ): Promise<PresignedUploadResult> {
    const {
      storageKey,
      mimeType = 'application/octet-stream',
      fileSize,
      expiresInSeconds = 900, // 15 minutes default
    } = options;

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const headers: Record<string, string> = {
      'Content-Type': mimeType,
      'x-amz-server-side-encryption': 'AES256',
    };

    if (this.client && this.isConfigured) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: mimeType,
        ContentLength: fileSize,
        ServerSideEncryption: 'AES256',
      });

      const uploadUrl = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });

      return {
        uploadUrl,
        storageKey,
        expiresAt,
        headers,
      };
    }

    // Fallback/Mock URL when running in dev/test environment without S3 credentials
    const baseUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const mockUploadUrl = `${baseUrl}/api/files/storage-mock/${this.bucket}/${encodeURIComponent(
      storageKey
    )}?expires=${expiresAt.getTime()}&sse=AES256`;

    return {
      uploadUrl: mockUploadUrl,
      storageKey,
      expiresAt,
      headers,
    };
  }

  /**
   * Generates a pre-signed GET URL for temporary secure download
   */
  async generatePresignedDownloadUrl(
    storageKey: string,
    expiresInSeconds = 900
  ): Promise<string> {
    if (this.client && this.isConfigured) {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      return getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });
    }

    const baseUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return `${baseUrl}/api/files/storage-mock/${this.bucket}/${encodeURIComponent(
      storageKey
    )}?download=true`;
  }

  /**
   * Deletes an object from the S3 / R2 bucket
   */
  async deleteObject(storageKey: string): Promise<void> {
    if (this.client && this.isConfigured) {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });
      await this.client.send(command);
    }
  }

  /**
   * Checks if an object exists in the S3 / R2 bucket
   */
  async objectExists(storageKey: string): Promise<boolean> {
    if (this.client && this.isConfigured) {
      try {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        });
        await this.client.send(command);
        return true;
      } catch (err: any) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          return false;
        }
        throw err;
      }
    }
    return true;
  }
}
