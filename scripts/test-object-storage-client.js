"use strict";

const assert = require("node:assert/strict");
const {
  METADATA_TOKEN_URL,
  createObjectStorageClient,
  objectUrl,
  validateObjectKey
} = require("../cloud/object-storage-client");

function response(status, body, headers) {
  const bytes = Buffer.from(body || "", "utf8");
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => (headers || {})[String(name).toLowerCase()] || null },
    json: async () => JSON.parse(bytes.toString("utf8")),
    arrayBuffer: async () => bytes
  };
}

(async function main() {
  assert.equal(objectUrl("assessment-private", "reports/FA-ABCDE.txt"),
    "https://storage.yandexcloud.net/assessment-private/reports/FA-ABCDE.txt");
  assert.throws(() => validateObjectKey("../secret"), /invalid_storage_object_key/);
  assert.throws(() => validateObjectKey("reports//file.txt"), /invalid_storage_object_key/);

  const calls = [];
  const fetchWithContext = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "PUT") return response(200);
    if (options.method === "GET") return response(200, "report", { "content-length": "6" });
    return response(204);
  };
  const client = createObjectStorageClient({ bucket: "assessment-private", fetchImpl: fetchWithContext });
  const context = { token: { access_token: "token-" + "x".repeat(32) } };
  assert.deepEqual(await client.writeText("reports/FA-ABCDE.txt", "report", context, { createOnly: true }), { created: true });
  assert.equal(calls[0].options.headers.Authorization, "Bearer token-" + "x".repeat(32));
  assert.equal(calls[0].options.headers["If-None-Match"], "*");
  assert.match(calls[0].options.headers["X-Amz-Checksum-Sha256"], /^[A-Za-z0-9+/]+=*$/);
  assert.equal(await client.readText("reports/FA-ABCDE.txt", context), "report");
  await client.deleteObject("reports/FA-ABCDE.txt", context);

  const metadataCalls = [];
  const fetchWithMetadata = async (url, options) => {
    metadataCalls.push({ url, options });
    if (url === METADATA_TOKEN_URL) return response(200, JSON.stringify({ access_token: "metadata-" + "y".repeat(32) }));
    return response(404);
  };
  const metadataClient = createObjectStorageClient({ bucket: "assessment-private", fetchImpl: fetchWithMetadata });
  assert.equal(await metadataClient.readText("banks/fa.json", {}), null);
  assert.equal(metadataCalls[0].options.headers["Metadata-Flavor"], "Google");
  assert.equal(metadataCalls[1].options.headers.Authorization, "Bearer metadata-" + "y".repeat(32));

  const tooLarge = createObjectStorageClient({
    bucket: "assessment-private",
    maxObjectBytes: 4,
    fetchImpl: async () => response(200, "12345", { "content-length": "5" })
  });
  await assert.rejects(tooLarge.readText("reports/a.txt", context), /storage_object_too_large/);

  console.log("Object Storage client checks passed: metadata identity, bearer auth, path hardening, checksums and size limits.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
