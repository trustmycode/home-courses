import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Получает email пользователя из Cloudflare Access заголовка или возвращает null.
 * Не бросает исключения, безопасна для использования в любом контексте.
 */
export async function getUserEmailOrNull(): Promise<string | null> {
  const h = await headers();
  const email = h.get("Cf-Access-Authenticated-User-Email");

  if (!email && process.env.NODE_ENV === "development") {
    return process.env.DEV_USER_EMAIL ?? "developer@localhost";
  }

  return email;
}

/**
 * Требует авторизованного пользователя для API routes.
 * Возвращает либо email (string), либо NextResponse с 401 статусом.
 * Использование:
 * ```typescript
 * const emailOrResponse = await requireUserEmail();
 * if (emailOrResponse instanceof NextResponse) return emailOrResponse;
 * const email = emailOrResponse;
 * ```
 */
export async function requireUserEmail(): Promise<string | NextResponse> {
  const email = await getUserEmailOrNull();

  if (!email) {
    return NextResponse.json(
      { error: "Unauthorized: no Cloudflare Access email header" },
      { status: 401 }
    );
  }

  return email;
}

/**
 * Парсит JWT и извлекает поле sub (user_id)
 * JWT формат: header.payload.signature (base64url)
 */
function extractSubFromJWT(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Декодируем payload (вторая часть)
    const payload = parts[1];
    // Добавляем padding если нужно (base64url может быть без padding)
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(decoded);
    
    return parsed.sub || null;
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    return null;
  }
}

/**
 * Извлекает user_id (sub) из JWT cookie Cloudflare Access
 * @returns user_id или null если не найден
 */
export async function getUserIdOrNull(): Promise<string | null> {
  const h = await headers();
  const cookieHeader = h.get("cookie");
  
  if (!cookieHeader) return null;
  
  // Ищем CF_Authorization cookie (стандартный для Cloudflare Access)
  const match = cookieHeader.match(/CF_Authorization=([^;]+)/);
  if (!match) {
    // Fallback: ищем другие возможные cookie names
    const altMatch = cookieHeader.match(/(?:CF_|cf_)?[Aa]uthorization=([^;]+)/);
    if (!altMatch) return null;
    return extractSubFromJWT(altMatch[1]);
  }
  
  return extractSubFromJWT(match[1]);
}

/**
 * Требует авторизованного пользователя и возвращает user_id
 * Возвращает либо user_id (string), либо NextResponse с 401 статусом
 * Использует JWT sub как основной идентификатор, fallback на email
 */
export async function requireUserId(): Promise<string | NextResponse> {
  const userId = await getUserIdOrNull();
  
  if (!userId) {
    // Fallback на email если JWT недоступен (для обратной совместимости)
    const email = await getUserEmailOrNull();
    if (email) {
      // Используем email как user_id (для обратной совместимости)
      return email;
    }
    return NextResponse.json(
      { error: "Unauthorized: no user identifier found" },
      { status: 401 }
    );
  }
  
  return userId;
}

/**
 * @deprecated Используйте requireUserEmail() для API routes или getUserEmailOrNull() для других случаев.
 * Оставлена для обратной совместимости.
 */
export async function getUserEmail(): Promise<string> {
  const emailOrResponse = await requireUserEmail();
  
  if (emailOrResponse instanceof NextResponse) {
    throw new Error("Unauthorized: no Cloudflare Access email header");
  }

  return emailOrResponse;
}
