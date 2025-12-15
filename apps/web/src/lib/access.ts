import { headers } from "next/headers";

export function getUserEmail(): string {
  const h = headers();

  const email = h.get("Cf-Access-Authenticated-User-Email");

  if (!email && process.env.NODE_ENV === "development") {
    return process.env.DEV_USER_EMAIL ?? "developer@localhost";
  }

  if (!email) throw new Error("Unauthorized: no Cloudflare Access email header");

  return email;
}

