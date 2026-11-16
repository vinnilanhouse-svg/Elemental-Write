import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  const allowed = (Deno.env.get("APP_ORIGINS") || "").split(",");
  const headers = {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Content-Type": "application/json",
  };
  const reply = (status: number, message: string) =>
    new Response(JSON.stringify({ message }), { status, headers });
  if (!allowed.includes(origin)) return reply(403, "Origem não permitida");
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return reply(405, "Método inválido");
  try {
    const token = request.headers
      .get("authorization")
      ?.replace(/^Bearer /i, "");
    if (!token) return reply(401, "Autenticação necessária");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user) return reply(401, "Sessão inválida");
    // Require a fresh password authentication, not merely a refreshed access token.
    const { data: claims, error: claimError } =
      await admin.auth.getClaims(token);
    const methods = claims?.claims.amr as
      | { method: string; timestamp: number }[]
      | undefined;
    if (
      claimError ||
      !methods?.some(
        (m) => m.method === "password" && Date.now() / 1000 - m.timestamp < 300,
      )
    )
      return reply(403, "Confirme sua senha novamente");
    if ((await request.json()).confirmation !== "EXCLUIR")
      return reply(400, "Confirmação necessária");
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error)
      return reply(500, "Não foi possível excluir a conta. Tente novamente.");
    return reply(200, "Conta excluída");
  } catch {
    return reply(400, "Solicitação inválida");
  }
});
