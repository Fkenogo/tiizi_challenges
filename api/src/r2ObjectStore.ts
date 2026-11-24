import { createHash, createHmac } from 'node:crypto';

export interface ObjectStorePutParams {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

export interface ObjectStoreSignedReadParams {
  key: string;
  expiresInSeconds: number;
  responseCacheControl?: string;
}

export interface ObjectStore {
  putObject(params: ObjectStorePutParams): Promise<void>;
  deleteObject(params: { key: string }): Promise<void>;
  getSignedReadUrl(params: ObjectStoreSignedReadParams): string;
}

export interface R2Config {
  accountId: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  readUrlTtlSeconds: number;
}

const DEFAULT_READ_URL_TTL_SECONDS = 60;
const MIN_READ_URL_TTL_SECONDS = 15;
const MAX_READ_URL_TTL_SECONDS = 300;
const EMPTY_PAYLOAD_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeS3Path(pathSegments: string[]): string {
  return `/${pathSegments.map((s) => encodeRfc3986(s)).join('/')}`;
}

function formatAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function signingKey(secretAccessKey: string, dateStamp: string): Buffer {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, 'auto');
  const kService = hmacSha256(kRegion, 's3');
  return hmacSha256(kService, 'aws4_request');
}

export function resolveR2ReadUrlTtlSeconds(raw = process.env.MEDIA_READ_URL_TTL_SECONDS): number {
  if (!raw || !raw.trim()) return DEFAULT_READ_URL_TTL_SECONDS;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < MIN_READ_URL_TTL_SECONDS || parsed > MAX_READ_URL_TTL_SECONDS) {
    throw new Error(
      `MEDIA_READ_URL_TTL_SECONDS must be an integer between ${MIN_READ_URL_TTL_SECONDS} and ${MAX_READ_URL_TTL_SECONDS}`,
    );
  }
  return parsed;
}

export function resolveR2ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): R2Config | null {
  const accountId = env.R2_ACCOUNT_ID?.trim() ?? '';
  const bucket = env.R2_BUCKET?.trim() ?? '';
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() ?? '';
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() ?? '';
  const rawEndpoint = env.R2_ENDPOINT?.trim() ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  const anySet = Boolean(accountId || bucket || accessKeyId || secretAccessKey || env.R2_ENDPOINT?.trim());
  if (!anySet) {
    return null;
  }

  if (!accountId || !bucket || !rawEndpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Incomplete Cloudflare R2 configuration: R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (and R2_ENDPOINT) are required',
    );
  }

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(rawEndpoint);
  } catch {
    throw new Error('R2_ENDPOINT must be a valid URL');
  }

  if (parsedEndpoint.hostname.endsWith('.r2.dev') || parsedEndpoint.hostname === 'r2.dev') {
    throw new Error('Public r2.dev endpoints are forbidden for private Tiizi media storage');
  }
  if (parsedEndpoint.protocol !== 'https:') {
    throw new Error('R2_ENDPOINT must use https://');
  }

  const prodBucket = env.TIIZI_R2_PROD_BUCKET?.trim();
  const isProdEnv = env.NODE_ENV === 'production' && env.TIIZI_ENV === 'production';
  if (!isProdEnv && prodBucket && bucket === prodBucket) {
    throw new Error('Refusing to use production R2 bucket in a non-production environment');
  }

  return {
    accountId,
    bucket,
    endpoint: parsedEndpoint.origin,
    accessKeyId,
    secretAccessKey,
    readUrlTtlSeconds: resolveR2ReadUrlTtlSeconds(env.MEDIA_READ_URL_TTL_SECONDS),
  };
}

export class CloudflareR2ObjectStore implements ObjectStore {
  private readonly endpointUrl: URL;

  constructor(private readonly config: R2Config) {
    this.endpointUrl = new URL(config.endpoint);
  }

  private objectPath(key: string): string {
    const cleanKey = key.replace(/^\/+/, '');
    return encodeS3Path([this.config.bucket, ...cleanKey.split('/')]);
  }

  private async signedRequest(
    method: 'PUT' | 'DELETE',
    key: string,
    body?: Buffer,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    const now = new Date();
    const { amzDate, dateStamp } = formatAmzDate(now);
    const canonicalUri = this.objectPath(key);
    const payloadHash = body ? sha256Hex(body) : EMPTY_PAYLOAD_HASH;

    const headers: Record<string, string> = {
      host: this.endpointUrl.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...extraHeaders,
    };

    const sortedHeaderKeys = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort();
    const canonicalHeaders = sortedHeaderKeys
      .map((k) => {
        const rawKey = Object.keys(headers).find((orig) => orig.toLowerCase() === k)!;
        return `${k}:${headers[rawKey].trim()}\n`;
      })
      .join('');
    const signedHeaders = sortedHeaderKeys.join(';');

    const canonicalRequest = [
      method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signature = createHmac('sha256', signingKey(this.config.secretAccessKey, dateStamp))
      .update(stringToSign, 'utf8')
      .digest('hex');

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const fetchHeaders: Record<string, string> = {
      ...headers,
      Authorization: authorization,
    };
    delete fetchHeaders.host;

    return fetch(`${this.endpointUrl.origin}${canonicalUri}`, {
      method,
      headers: fetchHeaders,
      body: body ? new Uint8Array(body) : undefined,
    });
  }

  async putObject(params: ObjectStorePutParams): Promise<void> {
    const res = await this.signedRequest('PUT', params.key, params.body, {
      'content-type': params.contentType,
      'cache-control': params.cacheControl ?? 'private, max-age=31536000, immutable',
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`R2 putObject failed (${res.status}): ${detail.slice(0, 200)}`);
    }
  }

  async deleteObject(params: { key: string }): Promise<void> {
    const res = await this.signedRequest('DELETE', params.key);
    if (!res.ok && res.status !== 404) {
      const detail = await res.text().catch(() => '');
      throw new Error(`R2 deleteObject failed (${res.status}): ${detail.slice(0, 200)}`);
    }
  }

  getSignedReadUrl(params: ObjectStoreSignedReadParams): string {
    const now = new Date();
    const { amzDate, dateStamp } = formatAmzDate(now);
    const canonicalUri = this.objectPath(params.key);
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const expires = Math.max(
      MIN_READ_URL_TTL_SECONDS,
      Math.min(MAX_READ_URL_TTL_SECONDS, Math.floor(params.expiresInSeconds)),
    );

    const queryParams: Array<[string, string]> = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${this.config.accessKeyId}/${credentialScope}`],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(expires)],
      ['X-Amz-SignedHeaders', 'host'],
    ];
    if (params.responseCacheControl) {
      queryParams.push(['response-cache-control', params.responseCacheControl]);
    }
    queryParams.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    const canonicalQuery = queryParams
      .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
      .join('&');

    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQuery,
      `host:${this.endpointUrl.host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signature = createHmac('sha256', signingKey(this.config.secretAccessKey, dateStamp))
      .update(stringToSign, 'utf8')
      .digest('hex');

    return `${this.endpointUrl.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }
}

export function createR2ObjectStoreFromEnv(env: NodeJS.ProcessEnv = process.env): {
  store: ObjectStore | null;
  readUrlTtlSeconds: number;
} {
  const config = resolveR2ConfigFromEnv(env);
  if (!config) {
    return { store: null, readUrlTtlSeconds: DEFAULT_READ_URL_TTL_SECONDS };
  }
  return {
    store: new CloudflareR2ObjectStore(config),
    readUrlTtlSeconds: config.readUrlTtlSeconds,
  };
}
