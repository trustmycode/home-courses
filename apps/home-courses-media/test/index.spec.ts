import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker, { type Env } from "../src";

const TOKEN = "test-only-internal-token";
const KEY = "tests/sample.txt";
const CONTENT = "0123456789";

function request(
  path = `/media/${KEY}`,
  init: RequestInit = {},
  token = TOKEN
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  const testEnv: Env = {
    COURSE_MEDIA: env.COURSE_MEDIA,
    MEDIA_INTERNAL_TOKEN: TOKEN,
  };
  return worker.fetch(new Request(`https://media.internal${path}`, { ...init, headers }), testEnv);
}

describe("раздача материалов", () => {
  beforeEach(async () => {
    await env.COURSE_MEDIA.put(KEY, CONTENT, {
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
    });
  });

  it("закрывается при отсутствии служебного ключа", async () => {
    const response = await worker.fetch(
      new Request(`https://media.internal/media/${KEY}`),
      { COURSE_MEDIA: env.COURSE_MEDIA, MEDIA_INTERNAL_TOKEN: "" }
    );
    expect(response.status).toBe(503);
  });

  it("отклоняет отсутствующий и неверный ключ", async () => {
    expect((await request(undefined, {}, "")).status).toBe(401);
    expect((await request(undefined, {}, "wrong-token")).status).toBe(401);
  });

  it("возвращает полный файл с закрытым кэшированием", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(await response.text()).toBe(CONTENT);
  });

  it("поддерживает частичный запрос и HEAD", async () => {
    const partial = await request(undefined, { headers: { range: "bytes=2-5" } });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await partial.text()).toBe("2345");

    const head = await request(undefined, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("10");
    expect(await head.text()).toBe("");
  });

  it("отклоняет некорректный диапазон и неподдерживаемый метод", async () => {
    expect((await request(undefined, { headers: { range: "bytes=bad" } })).status).toBe(416);
    expect((await request(undefined, { method: "POST" })).status).toBe(405);
  });
});
