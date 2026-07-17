import { headers } from "next/headers";
import { NextResponse } from "next/server";

type AccessClaims = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  sub?: string;
};

type JsonWebKeyWithId = JsonWebKey & { kid?: string };

type CachedKeys = {
  expiresAt: number;
  keys: JsonWebKeyWithId[];
};

const KEY_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedKeys: CachedKeys | null = null;

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function decodeJsonPart<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    return null;
  }
}

function getIssuer(): string | null {
  const configured = process.env.CF_ACCESS_TEAM_DOMAIN?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".cloudflareaccess.com") ||
      url.pathname !== "/"
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function getExpectedAudiences(): string[] {
  return (process.env.CF_ACCESS_AUD ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function getSigningKeys(issuer: string): Promise<JsonWebKeyWithId[]> {
  const now = Date.now();
  if (cachedKeys && cachedKeys.expiresAt > now) return cachedKeys.keys;

  const response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("Не удалось получить ключи Cloudflare Access");

  const body = (await response.json()) as { keys?: JsonWebKeyWithId[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("Cloudflare Access вернул пустой набор ключей");
  }

  cachedKeys = { keys: body.keys, expiresAt: now + KEY_CACHE_TTL_MS };
  return body.keys;
}

function audienceMatches(claim: string | string[] | undefined, expected: string[]): boolean {
  const actual = Array.isArray(claim) ? claim : claim ? [claim] : [];
  return expected.some((value) => actual.includes(value));
}

async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const header = decodeJsonPart<{ alg?: string; kid?: string }>(parts[0]);
  const claims = decodeJsonPart<AccessClaims>(parts[1]);
  const issuer = getIssuer();
  const expectedAudiences = getExpectedAudiences();

  if (
    !header ||
    header.alg !== "RS256" ||
    !header.kid ||
    !claims ||
    !issuer ||
    expectedAudiences.length === 0
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== issuer ||
    !claims.sub ||
    !Number.isFinite(claims.exp) ||
    claims.exp! <= now ||
    (claims.nbf !== undefined && claims.nbf > now) ||
    (claims.iat !== undefined && claims.iat > now + 60) ||
    !audienceMatches(claims.aud, expectedAudiences)
  ) {
    return null;
  }

  const keys = await getSigningKeys(issuer);
  const key = keys.find((candidate) => candidate.kid === header.kid);
  if (!key) {
    cachedKeys = null;
    return null;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );

  return valid ? claims : null;
}

function tokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const [name, ...valueParts] = item.trim().split("=");
    if (name === "CF_Authorization") return valueParts.join("=") || null;
  }
  return null;
}

async function getVerifiedClaims(): Promise<AccessClaims | null> {
  const requestHeaders = await headers();
  const token =
    requestHeaders.get("Cf-Access-Jwt-Assertion") ??
    tokenFromCookie(requestHeaders.get("cookie"));
  if (!token) return null;

  try {
    return await verifyAccessToken(token);
  } catch (error) {
    console.error("Не удалось проверить авторизацию Cloudflare Access", error);
    return null;
  }
}

export async function getUserEmailOrNull(): Promise<string | null> {
  const claims = await getVerifiedClaims();
  if (claims?.email) return claims.email;
  if (process.env.NODE_ENV === "development") {
    return process.env.DEV_USER_EMAIL ?? null;
  }
  return null;
}

export async function requireUserEmail(): Promise<string | NextResponse> {
  const email = await getUserEmailOrNull();
  return email ?? NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
}

export async function getUserIdOrNull(): Promise<string | null> {
  const claims = await getVerifiedClaims();
  if (claims?.sub) return claims.sub;
  if (process.env.NODE_ENV === "development") {
    return process.env.DEV_USER_ID ?? process.env.DEV_USER_EMAIL ?? null;
  }
  return null;
}

export async function requireUserId(): Promise<string | NextResponse> {
  const userId = await getUserIdOrNull();
  return userId ?? NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
}

/** @deprecated Используйте requireUserEmail. */
export async function getUserEmail(): Promise<string> {
  const result = await requireUserEmail();
  if (result instanceof NextResponse) throw new Error("Требуется авторизация");
  return result;
}
