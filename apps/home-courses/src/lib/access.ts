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
