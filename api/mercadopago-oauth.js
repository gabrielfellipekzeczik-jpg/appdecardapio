// api/mercadopago-oauth.js — Vercel Serverless Function
// Adaptado do app de eventos. Consolida o fluxo OAuth do Mercado Pago:
//   POST { action: 'connect', code, company_id, redirect_uri } → troca o code pelo access_token
//   POST { action: 'disconnect', company_id }                  → remove as credenciais
//   POST { action: 'info', company_id }                        → retorna mp_user_id conectado
//
// Diferença do app de eventos: usa a tabela marmitaria.integration_settings
// em vez de company_payment_credentials — ela já existe e já armazena as
// credenciais criptografadas (AES-GCM via INTEGRATIONS_ENCRYPTION_KEY).

import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ─── Criptografia (espelha server/_core/crypto.ts) ───────────────────────────

function getEncKey() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) throw new Error("INTEGRATIONS_ENCRYPTION_KEY não configurada");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("INTEGRATIONS_ENCRYPTION_KEY deve ter 32 bytes em base64");
  return key;
}

function encryptJson(value) {
  const key = getEncKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const pt = Buffer.from(JSON.stringify(value), "utf-8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

function decryptJson(payload) {
  const key = getEncKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf-8"));
}

// ─── Verificação de permissão ────────────────────────────────────────────────

async function checkPermission(supabase, user, company_id) {
  const { data: company } = await supabase
    .from("companies").select("id").eq("id", company_id).single();
  // No app de marmitas não há team_members — só o usuário dono da empresa
  // (companyId vinculado no campo supabaseUserId) tem acesso.
  const { data: appUser } = await supabase
    .from("users").select("companyId, role").eq("supabaseUserId", user.id).maybeSingle();
  const isOwner = appUser?.companyId === company_id;
  const isSuperAdmin = process.env.OWNER_EMAIL && user.email?.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase();
  return !!company && (isOwner || !!isSuperAdmin);
}

// ─── Handler principal ───────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, company_id } = req.body || {};

  let supabase;
  try { supabase = getSupabaseAdmin(); }
  catch (e) { return res.status(500).json({ error: e.message }); }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Não autenticado" });

  if (!company_id) return res.status(400).json({ error: "company_id é obrigatório" });
  const allowed = await checkPermission(supabase, user, company_id);
  if (!allowed) return res.status(403).json({ error: "Sem permissão para essa empresa" });

  // ── CONNECT ───────────────────────────────────────────────────────────────
  if (action === "connect" || !action) {
    const { code, redirect_uri } = req.body;
    if (!code || !redirect_uri) return res.status(400).json({ error: "code e redirect_uri são obrigatórios" });

    const clientId = process.env.MP_CLIENT_ID;
    const clientSecret = process.env.MP_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Mercado Pago não está configurado no servidor." });
    }

    try {
      const tokenResp = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri }),
      });
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok) {
        return res.status(400).json({ error: tokenData.message || "Falha ao obter token do Mercado Pago" });
      }

      const { access_token, refresh_token, user_id, public_key, live_mode } = tokenData;
      const credentials = { accessToken: access_token, refreshToken: refresh_token, publicKey: public_key, userId: user_id, liveMode: live_mode };
      const encrypted = encryptJson(credentials);
      const now = new Date().toISOString();

      const { error: upsertError } = await supabase.from("integration_settings").upsert({
        companyId: company_id,
        provider: "mercadopago",
        connected: true,
        credentials: encrypted,
        metadata: JSON.stringify({ publicKey: public_key, userId: String(user_id), liveMode: live_mode }),
        connectedAt: now,
        updatedAt: now,
      }, { onConflict: "companyId,provider" });

      if (upsertError) {
        console.error("integration_settings upsert error:", upsertError);
        return res.status(500).json({ error: "Falha ao salvar credenciais do Mercado Pago" });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("mercadopago-oauth connect error:", err);
      return res.status(500).json({ error: "Erro inesperado ao conectar o Mercado Pago" });
    }
  }

  // ── DISCONNECT ────────────────────────────────────────────────────────────
  if (action === "disconnect") {
    try {
      await supabase.from("integration_settings")
        .update({ connected: false, credentials: null, updatedAt: new Date().toISOString() })
        .eq("companyId", company_id)
        .eq("provider", "mercadopago");
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("mercadopago-oauth disconnect error:", err);
      return res.status(500).json({ error: "Erro ao desconectar o Mercado Pago" });
    }
  }

  // ── INFO ──────────────────────────────────────────────────────────────────
  if (action === "info") {
    const { data } = await supabase.from("integration_settings")
      .select("metadata, connectedAt").eq("companyId", company_id).eq("provider", "mercadopago").maybeSingle();
    let userId = null;
    try { if (data?.metadata) userId = JSON.parse(data.metadata)?.userId ?? null; } catch {}
    return res.status(200).json({ mp_user_id: userId, mp_connected_at: data?.connectedAt ?? null });
  }

  return res.status(400).json({ error: "action inválida. Use connect, disconnect ou info." });
}
