// Runs the Edge handler with mocked Supabase admin responses; no production deletion.
import ts from "typescript";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
let handler,
  userError = false,
  deleteError = false,
  methods = [],
  deleted = [];
globalThis.Deno = {
  env: {
    get(name) {
      return {
        APP_ORIGINS: "https://write.example",
        SUPABASE_URL: "https://fixture.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "fixture-server-only",
      }[name];
    },
  },
  serve(fn) {
    handler = fn;
  },
};
globalThis.edgeCreateClient = () => ({
  auth: {
    getUser: async (token) => ({
      data: { user: token === "valid" ? { id: "verified-user" } : null },
      error: userError ? Error("invalid") : null,
    }),
    getClaims: async () => ({
      data: { claims: { amr: methods } },
      error: null,
    }),
    admin: {
      deleteUser: async (uid) => {
        deleted.push(uid);
        return { error: deleteError ? Error("failure") : null };
      },
    },
  },
});
const source = (
  await fs.readFile(
    new URL("../supabase/functions/delete-account/index.ts", import.meta.url),
    "utf8",
  )
).replace(
  /import\s+\{\s*createClient\s*\}\s+from\s+['"][^'"]+['"];?/,
  "const createClient = globalThis.edgeCreateClient;",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
const request = (overrides = {}) =>
  handler(
    new Request("https://fixture.invalid/functions/v1/delete-account", {
      method: "POST",
      headers: {
        origin: "https://write.example",
        authorization: "Bearer valid",
        "content-type": "application/json",
        ...overrides.headers,
      },
      body: JSON.stringify({
        confirmation: "EXCLUIR",
        user_id: "victim",
        ...overrides.body,
      }),
    }),
  );
assert.equal(
  (await request({ headers: { origin: "https://evil.example" } })).status,
  403,
);
assert.equal((await request({ headers: { authorization: "" } })).status, 401);
assert.equal(
  (await request({ headers: { authorization: "Bearer invalid" } })).status,
  401,
);
userError = true;
assert.equal((await request()).status, 401);
userError = false;
methods = [{ method: "password", timestamp: Date.now() / 1000 - 600 }];
assert.equal((await request()).status, 403);
methods = [{ method: "otp", timestamp: Date.now() / 1000 }];
assert.equal((await request()).status, 403);
assert.deepEqual(deleted, []);
console.log(
  "PASS exclusão rejeita origem indevida, JWT inválido, senha antiga e autenticação sem senha",
);
methods = [{ method: "password", timestamp: Date.now() / 1000 }];
assert.equal((await request({ body: { confirmation: "no" } })).status, 400);
assert.deepEqual(deleted, []);
assert.equal((await request()).status, 200);
assert.deepEqual(deleted, ["verified-user"]);
deleteError = true;
assert.equal((await request()).status, 500);
console.log(
  "PASS exclusão exige confirmação, usa somente ID verificado no servidor e retorna erro do serviço",
);
delete globalThis.Deno;
delete globalThis.edgeCreateClient;
