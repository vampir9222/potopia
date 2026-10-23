import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createR2Client,
  deleteObject,
  getStorage,
  headObject,
  presignGet,
  presignPut,
  putObject,
} from "../src/index";

// Client R2 fictif : la signature est calculée localement, sans appel réseau.
const r2 = createR2Client({
  accountId: "0123456789abcdef0123456789abcdef",
  accessKeyId: "fake-access-key",
  secretAccessKey: "fake-secret-key",
  bucket: "fake-bucket",
});

describe("URLs présignées (R2)", () => {
  it("PUT : bon bucket, bonne clé, type et taille signés, expiration courte", async () => {
    const url = new URL(
      await presignPut(
        { key: "ideas/abc.png", contentType: "image/png", contentLength: 1234, expiresIn: 300 },
        r2,
      ),
    );
    expect(url.hostname).toBe(
      "fake-bucket.0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    );
    expect(url.pathname).toBe("/ideas/abc.png");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining(["content-length", "content-type", "host"]),
    );
  });

  it("GET : 5 minutes par défaut", async () => {
    const url = new URL(await presignGet({ key: "ideas/abc.png" }, r2));
    expect(url.pathname).toBe("/ideas/abc.png");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
  });

  it("refuse une expiration longue et les clés douteuses", async () => {
    await expect(presignGet({ key: "a.png", expiresIn: 3600 }, r2)).rejects.toThrow();
    for (const key of ["../secret", "/abs.png", "a//b.png", "a/../b.png", "a b.png", ""]) {
      await expect(presignGet({ key }, r2)).rejects.toThrow();
    }
  });
});

describe("stockage local (docker-compose)", () => {
  it("upload via l'URL PUT, puis headObject et lecture via l'URL GET", async () => {
    const key = `tests/${randomUUID()}.png`;
    const body = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const putUrl = await presignPut({ key, contentType: "image/png", contentLength: body.length });

    const put = await fetch(putUrl, {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body,
    });
    expect(put.status).toBe(200);

    expect(await headObject(key)).toEqual({ contentType: "image/png", contentLength: body.length });
    const get = await fetch(await presignGet({ key }));
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(body);
  });

  it("refuse un PUT dont le type ne correspond pas à la signature", async () => {
    const key = `tests/${randomUUID()}.png`;
    const putUrl = await presignPut({ key, contentType: "image/png", contentLength: 3 });
    const put = await fetch(putUrl, {
      method: "PUT",
      headers: { "content-type": "text/html" },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(put.status).toBe(403);
    expect(await headObject(key)).toBeNull();
  });

  it("headObject renvoie null pour un objet absent", async () => {
    expect(await headObject(`tests/${randomUUID()}.png`)).toBeNull();
    expect(getStorage().bucket).toBe("app-test");
  });

  it("putObject envoie depuis le serveur avec son Cache-Control, deleteObject supprime", async () => {
    const key = `tests/${randomUUID()}.png`;
    const body = new Uint8Array([137, 80, 78, 71, 4, 5]);
    await putObject({ key, body, contentType: "image/png", cacheControl: "private, max-age=60" });
    expect(await headObject(key)).toEqual({ contentType: "image/png", contentLength: body.length });
    const get = await fetch(await presignGet({ key }));
    expect(get.headers.get("cache-control")).toBe("private, max-age=60");

    await deleteObject(key);
    expect(await headObject(key)).toBeNull();
    await expect(deleteObject(key)).resolves.toBeUndefined();
  });
});
