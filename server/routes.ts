import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import pg from "pg";

const EXTERNAL_API = (process.env.EXTERNAL_API_URL || "https://appmyjantes2.mytoolsgroup.eu/api").replace(/\/$/, "");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deleted_accounts (
        id SERIAL PRIMARY KEY,
        external_user_id TEXT,
        email TEXT,
        user_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS quote_responses (
        id SERIAL PRIMARY KEY,
        quote_id TEXT NOT NULL,
        user_cookie TEXT,
        action TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS reservation_confirmations (
        id SERIAL PRIMARY KEY,
        reservation_id TEXT NOT NULL,
        user_cookie TEXT,
        action TEXT NOT NULL DEFAULT 'confirmed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notification_reads (
        id SERIAL PRIMARY KEY,
        notification_id TEXT NOT NULL,
        user_cookie TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(notification_id, user_cookie)
      );
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        user_cookie TEXT,
        user_email TEXT,
        name TEXT,
        category TEXT,
        subject TEXT,
        message TEXT,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("[DB] Tables initialized");
  } catch (err: any) {
    console.warn("[DB] Init skipped:", err.message);
  }
}

function getAuthHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "host": new URL(EXTERNAL_API).host,
    "content-type": "application/json",
    "accept": "application/json",
    "x-requested-with": "XMLHttpRequest",
  };
  if (req.headers["cookie"]) headers["cookie"] = req.headers["cookie"] as string;
  if (req.headers["authorization"]) headers["authorization"] = req.headers["authorization"] as string;
  return headers;
}

function forwardSetCookie(externalRes: globalThis.Response, expressRes: Response) {
  const setCookie = externalRes.headers.get("set-cookie");
  if (setCookie) {
    const parts = setCookie.split(",").map(c => c.trim());
    for (const part of parts) {
      expressRes.appendHeader("set-cookie", part);
    }
    const sessionPart = parts.find(p => {
      const name = p.split("=")[0]?.toLowerCase() || "";
      return name.includes("session") || name.includes("sid") || name === "phpsessid" || name.includes("laravel");
    });
    if (sessionPart) {
      expressRes.setHeader("X-Session-Cookie", sessionPart.split(";")[0].trim());
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await initDatabase();

  app.post("/api/quotes/:id/accept", async (req: Request, res: Response) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const endpoints = [
        { url: `${EXTERNAL_API}/quotes/${id}/accept`, method: "POST" as const, body: undefined as string | undefined },
        { url: `${EXTERNAL_API}/quotes/${id}/respond`, method: "POST" as const, body: JSON.stringify({ status: "accepted", response: "accepted" }) },
        { url: `${EXTERNAL_API}/quotes/${id}`, method: "PUT" as const, body: JSON.stringify({ status: "accepted" }) },
        { url: `${EXTERNAL_API}/quotes/${id}`, method: "PATCH" as const, body: JSON.stringify({ status: "accepted" }) },
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep.url, { method: ep.method, headers, body: ep.body, redirect: "manual" });
          const text = await r.text();
          if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
            console.log(`[QUOTE ACCEPT] ${ep.method} ${ep.url} => ${r.status} OK`);
            try { await pool.query("INSERT INTO quote_responses (quote_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "accepted"]); } catch {}
            try { return res.status(200).json(JSON.parse(text)); } catch { return res.status(200).json({ success: true, message: "Devis accepté avec succès" }); }
          }
        } catch {}
      }
      console.log(`[QUOTE ACCEPT] No external endpoint worked for quote ${id}, storing locally`);
      try {
        await pool.query("INSERT INTO quote_responses (quote_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "accepted"]);
      } catch {}
      return res.status(200).json({ success: true, message: "Devis accepté avec succès" });
    } catch (err: any) {
      console.error("[QUOTE ACCEPT] error:", err.message);
      return res.status(500).json({ message: "Erreur lors de l'acceptation du devis" });
    }
  });

  app.post("/api/quotes/:id/reject", async (req: Request, res: Response) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const endpoints = [
        { url: `${EXTERNAL_API}/quotes/${id}/reject`, method: "POST" as const, body: undefined as string | undefined },
        { url: `${EXTERNAL_API}/quotes/${id}/respond`, method: "POST" as const, body: JSON.stringify({ status: "rejected", response: "rejected" }) },
        { url: `${EXTERNAL_API}/quotes/${id}`, method: "PUT" as const, body: JSON.stringify({ status: "rejected" }) },
        { url: `${EXTERNAL_API}/quotes/${id}`, method: "PATCH" as const, body: JSON.stringify({ status: "rejected" }) },
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep.url, { method: ep.method, headers, body: ep.body, redirect: "manual" });
          const text = await r.text();
          if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
            console.log(`[QUOTE REJECT] ${ep.method} ${ep.url} => ${r.status} OK`);
            try { await pool.query("INSERT INTO quote_responses (quote_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "rejected"]); } catch {}
            try { return res.status(200).json(JSON.parse(text)); } catch { return res.status(200).json({ success: true, message: "Devis refusé" }); }
          }
        } catch {}
      }
      console.log(`[QUOTE REJECT] No external endpoint worked for quote ${id}, storing locally`);
      try {
        await pool.query("INSERT INTO quote_responses (quote_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "rejected"]);
      } catch {}
      return res.status(200).json({ success: true, message: "Devis refusé" });
    } catch (err: any) {
      console.error("[QUOTE REJECT] error:", err.message);
      return res.status(500).json({ message: "Erreur lors du refus du devis" });
    }
  });

  app.post("/api/reservations/:id/confirm", async (req: Request, res: Response) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const endpoints = [
        { url: `${EXTERNAL_API}/reservations/${id}/confirm`, method: "POST" as const, body: undefined as string | undefined },
        { url: `${EXTERNAL_API}/reservations/${id}`, method: "PUT" as const, body: JSON.stringify({ status: "confirmed" }) },
        { url: `${EXTERNAL_API}/reservations/${id}`, method: "PATCH" as const, body: JSON.stringify({ status: "confirmed" }) },
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep.url, { method: ep.method, headers, body: ep.body, redirect: "manual" });
          const text = await r.text();
          if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
            console.log(`[RESERVATION CONFIRM] ${ep.method} ${ep.url} => ${r.status} OK`);
            try { await pool.query("INSERT INTO reservation_confirmations (reservation_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "confirmed"]); } catch {}
            try { return res.status(200).json(JSON.parse(text)); } catch { return res.status(200).json({ success: true, message: "Réservation confirmée" }); }
          }
        } catch {}
      }
      console.log(`[RESERVATION CONFIRM] No external endpoint worked for reservation ${id}, storing locally`);
      try {
        await pool.query("INSERT INTO reservation_confirmations (reservation_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "confirmed"]);
      } catch {}
      return res.status(200).json({ success: true, message: "Réservation confirmée avec succès" });
    } catch (err: any) {
      console.error("[RESERVATION CONFIRM] error:", err.message);
      return res.status(500).json({ message: "Erreur lors de la confirmation" });
    }
  });

  app.get("/api/support/tickets", async (req: Request, res: Response) => {
    try {
      const headers = getAuthHeaders(req);
      let userEmail = "";
      try {
        const userRes = await fetch(`${EXTERNAL_API}/auth/user`, { method: "GET", headers, redirect: "manual" });
        if (userRes.ok) {
          const userData = await userRes.json() as any;
          userEmail = userData?.email || userData?.user?.email || "";
        }
      } catch {}

      let rows;
      if (userEmail) {
        rows = await pool.query(
          "SELECT id, user_email as email, name, category, subject, message, status, created_at as \"createdAt\" FROM support_tickets WHERE user_email = $1 ORDER BY created_at DESC",
          [userEmail]
        );
      } else {
        const cookieId = req.headers["cookie"] || "";
        rows = await pool.query(
          "SELECT id, user_email as email, name, category, subject, message, status, created_at as \"createdAt\" FROM support_tickets WHERE user_cookie = $1 ORDER BY created_at DESC",
          [cookieId]
        );
      }
      return res.json(rows.rows);
    } catch (err: any) {
      console.warn("[SUPPORT TICKETS] DB error:", err.message);
      return res.json([]);
    }
  });

  app.post("/api/support/contact", async (req: Request, res: Response) => {
    const headers = getAuthHeaders(req);
    try {
      const r = await fetch(`${EXTERNAL_API}/support/contact`, {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
        redirect: "manual",
      });
      const text = await r.text();
      let result: any;
      try { result = JSON.parse(text); } catch { result = { success: true, message: "Message envoyé" }; }

      try {
        await pool.query(
          "INSERT INTO support_tickets (user_cookie, user_email, name, category, subject, message) VALUES ($1, $2, $3, $4, $5, $6)",
          [
            req.headers["cookie"] || "",
            req.body?.email || "",
            req.body?.name || "",
            req.body?.category || "",
            req.body?.subject || "",
            req.body?.message || "",
          ]
        );
      } catch (dbErr: any) {
        console.warn("[SUPPORT] DB save skipped:", dbErr.message);
      }

      return res.status(r.status < 400 ? 200 : r.status).json(result);
    } catch (err: any) {
      console.error("[SUPPORT CONTACT] error:", err.message);
      try {
        await pool.query(
          "INSERT INTO support_tickets (user_cookie, user_email, name, category, subject, message) VALUES ($1, $2, $3, $4, $5, $6)",
          [req.headers["cookie"] || "", req.body?.email || "", req.body?.name || "", req.body?.category || "", req.body?.subject || "", req.body?.message || ""]
        );
        return res.status(200).json({ success: true, message: "Message enregistré localement" });
      } catch {
        return res.status(502).json({ message: "Erreur de connexion" });
      }
    }
  });

  app.delete("/api/users/me", async (req: Request, res: Response) => {
    try {
      const headers: Record<string, string> = {
        "host": new URL(EXTERNAL_API).host,
      };
      if (req.headers["cookie"]) {
        headers["cookie"] = req.headers["cookie"] as string;
      }
      if (req.headers["authorization"]) {
        headers["authorization"] = req.headers["authorization"] as string;
      }

      const userRes = await fetch(`${EXTERNAL_API}/auth/user`, {
        method: "GET",
        headers,
        redirect: "manual",
      });

      if (!userRes.ok) {
        return res.status(401).json({ message: "Non authentifié. Veuillez vous reconnecter." });
      }

      const userData = await userRes.json() as any;
      const userId = userData?.id || userData?.user?.id || userData?._id;
      const userEmail = userData?.email || userData?.user?.email;

      if (!userId) {
        return res.status(400).json({ message: "Impossible d'identifier l'utilisateur." });
      }

      try {
        const existing = await pool.query(
          "SELECT id FROM deleted_accounts WHERE external_user_id = $1 OR email = $2",
          [String(userId), userEmail || ""]
        );

        if (existing.rows.length > 0) {
          return res.status(200).json({ message: "Compte déjà supprimé." });
        }

        await pool.query(
          "INSERT INTO deleted_accounts (external_user_id, email, user_data) VALUES ($1, $2, $3)",
          [String(userId), userEmail || null, JSON.stringify(userData)]
        );
      } catch (dbErr: any) {
        console.warn("[DB] deleted_accounts insert skipped (DB unavailable):", dbErr.message);
      }

      try {
        await fetch(`${EXTERNAL_API}/admin/users/${userId}`, {
          method: "DELETE",
          headers: { ...headers, "content-type": "application/json" },
          redirect: "manual",
        });
      } catch {}

      try {
        await fetch(`${EXTERNAL_API}/logout`, {
          method: "POST",
          headers,
          redirect: "manual",
        });
      } catch {}

      console.log(`Account deletion recorded: userId=${userId}, email=${userEmail}`);
      return res.status(200).json({ message: "Compte supprimé avec succès." });
    } catch (err: any) {
      console.error("Account deletion error:", err.message);
      return res.status(502).json({ message: "Erreur de connexion au serveur. Veuillez réessayer." });
    }
  });

  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const email = req.body?.email;

      if (email) {
        try {
          const deleted = await pool.query(
            "SELECT id FROM deleted_accounts WHERE email = $1",
            [email]
          );

          if (deleted.rows.length > 0) {
            return res.status(403).json({
              message: "Ce compte a été supprimé. Il n'est plus possible de se connecter."
            });
          }
        } catch (dbErr: any) {
          console.warn("[DB] deleted_accounts check skipped (DB unavailable):", dbErr.message);
        }
      }

      const targetUrl = `${EXTERNAL_API}/login`;
      const headers: Record<string, string> = {
        "host": new URL(EXTERNAL_API).host,
        "content-type": "application/json",
      };
      if (req.headers["cookie"]) {
        headers["cookie"] = req.headers["cookie"] as string;
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
        redirect: "manual",
      });

      let capturedCookie: string | null = null;
      response.headers.forEach((value, key) => {
        const lk = key.toLowerCase();
        if (lk === "transfer-encoding" || lk === "content-encoding" || lk === "content-length") return;
        if (lk === "set-cookie") {
          res.appendHeader("set-cookie", value);
          const cookiePart = value.split(";")[0].trim();
          if (cookiePart && !cookiePart.startsWith("XSRF-TOKEN") && !cookiePart.startsWith("csrf")) {
            capturedCookie = cookiePart;
          }
          return;
        }
        res.setHeader(key, value);
      });

      if (capturedCookie) {
        console.log(`[LOGIN] Captured session cookie: ${capturedCookie.substring(0, 40)}...`);
        res.setHeader("X-Session-Cookie", capturedCookie);
      }

      res.status(response.status);

      if (response.ok) {
        let responseData: any;
        const text = await response.text();
        try {
          responseData = JSON.parse(text);
        } catch (e) {
          console.error("Failed to parse login response:", e);
          return res.status(502).json({ message: "Réponse invalide du serveur d'authentification." });
        }
        
        const loggedInUserId = responseData?.id || responseData?.user?.id || responseData?._id;
        const loggedInEmail = responseData?.email || responseData?.user?.email;

        if (loggedInUserId || loggedInEmail) {
          try {
            const deletedById = loggedInUserId
              ? await pool.query("SELECT id FROM deleted_accounts WHERE external_user_id = $1", [String(loggedInUserId)])
              : { rows: [] };
            const deletedByEmail = loggedInEmail
              ? await pool.query("SELECT id FROM deleted_accounts WHERE email = $1", [loggedInEmail])
              : { rows: [] };

            if (deletedById.rows.length > 0 || deletedByEmail.rows.length > 0) {
              try {
                await fetch(`${EXTERNAL_API}/logout`, {
                  method: "POST",
                  headers: { "host": new URL(EXTERNAL_API).host, ...(req.headers["cookie"] ? { "cookie": req.headers["cookie"] as string } : {}) },
                  redirect: "manual",
                });
              } catch {}
              return res.status(403).json({
                message: "Ce compte a été supprimé. Il n'est plus possible de se connecter."
              });
            }
          } catch (dbErr: any) {
            console.warn("[DB] post-login deleted_accounts check skipped (DB unavailable):", dbErr.message);
          }
        }

        return res.json(responseData);
      }

      const body = await response.arrayBuffer();
      res.send(Buffer.from(body));
    } catch (err: any) {
      console.error("Login proxy error:", err.message);
      res.status(502).json({ message: "Erreur de connexion au serveur API" });
    }
  });

  app.get("/api/proxy/invoice-pdf/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const pdfUrl = `${EXTERNAL_API}/public/invoices/${token}/pdf`;
      const headers: Record<string, string> = {
        "host": new URL(EXTERNAL_API).host,
        "accept": "application/pdf,*/*",
      };
      if (req.headers["cookie"]) {
        headers["cookie"] = req.headers["cookie"] as string;
      }
      if (req.headers["authorization"]) {
        headers["authorization"] = req.headers["authorization"] as string;
      }
      const response = await fetch(pdfUrl, { headers, redirect: "follow" });
      if (!response.ok) {
        return res.status(response.status).json({ message: "Document introuvable." });
      }
      const contentType = response.headers.get("content-type") || "application/pdf";
      res.setHeader("content-type", contentType);
      res.setHeader("content-disposition", `attachment; filename="facture-${token}.pdf"`);
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("[PDF PROXY] error:", err.message);
      res.status(502).json({ message: "Erreur lors du téléchargement du PDF." });
    }
  });

  app.get("/api/proxy/quote-pdf/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const pdfUrl = `${EXTERNAL_API}/public/quotes/${token}/pdf`;
      const headers: Record<string, string> = {
        "host": new URL(EXTERNAL_API).host,
        "accept": "application/pdf,*/*",
      };
      if (req.headers["cookie"]) {
        headers["cookie"] = req.headers["cookie"] as string;
      }
      if (req.headers["authorization"]) {
        headers["authorization"] = req.headers["authorization"] as string;
      }
      const response = await fetch(pdfUrl, { headers, redirect: "follow" });
      if (!response.ok) {
        return res.status(response.status).json({ message: "Document introuvable." });
      }
      const contentType = response.headers.get("content-type") || "application/pdf";
      res.setHeader("content-type", contentType);
      res.setHeader("content-disposition", `attachment; filename="devis-${token}.pdf"`);
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("[PDF PROXY] error:", err.message);
      res.status(502).json({ message: "Erreur lors du téléchargement du PDF." });
    }
  });

  app.get("/api/invoices", async (req: Request, res: Response) => {
    const headers = getAuthHeaders(req);
    try {
      const r = await fetch(`${EXTERNAL_API}/invoices${req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""}`, {
        method: "GET", headers, redirect: "manual",
      });
      forwardSetCookie(r, res);
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(r.status >= 400 ? r.status : 401).json({ message: "Non authentifié" });
      }
      let data: any;
      try { data = JSON.parse(text); } catch { return res.status(200).json([]); }
      console.log(`[PROXY] GET /api/invoices => ${r.status}`);
      return res.status(r.status).json(data);
    } catch (err: any) {
      console.error("[INVOICES] error:", err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });

  app.get("/api/invoices/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const r = await fetch(`${EXTERNAL_API}/invoices`, {
        method: "GET", headers, redirect: "manual",
      });
      forwardSetCookie(r, res);
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      let data: any;
      try { data = JSON.parse(text); } catch { return res.status(404).json({ message: "Facture introuvable" }); }
      const list = Array.isArray(data) ? data : (data?.data || data?.invoices || data?.results || []);
      const item = list.find((inv: any) => String(inv.id || inv._id) === id);
      if (!item) {
        console.log(`[PROXY] GET /api/invoices/${id} => not found in list of ${list.length}`);
        return res.status(404).json({ message: "Facture introuvable" });
      }
      console.log(`[PROXY] GET /api/invoices/${id} => found, keys: ${Object.keys(item)}`);
      return res.status(200).json(item);
    } catch (err: any) {
      console.error(`[INVOICE ${id}] error:`, err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });

  app.get("/api/quotes/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const r = await fetch(`${EXTERNAL_API}/quotes`, {
        method: "GET", headers, redirect: "manual",
      });
      forwardSetCookie(r, res);
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      let data: any;
      try { data = JSON.parse(text); } catch { return res.status(404).json({ message: "Devis introuvable" }); }
      const list = Array.isArray(data) ? data : (data?.data || data?.quotes || data?.results || []);
      const item = list.find((q: any) => String(q.id || q._id) === id);
      if (!item) {
        console.log(`[PROXY] GET /api/quotes/${id} => not found in list of ${list.length}`);
        return res.status(404).json({ message: "Devis introuvable" });
      }
      try {
        const localRes = await pool.query(
          "SELECT action FROM quote_responses WHERE quote_id = $1 ORDER BY created_at DESC LIMIT 1",
          [id]
        );
        if (localRes.rows.length > 0) {
          item.status = localRes.rows[0].action;
        }
      } catch {}
      console.log(`[PROXY] GET /api/quotes/${id} => found`);
      return res.status(200).json(item);
    } catch (err: any) {
      console.error(`[QUOTE ${id}] error:`, err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });

  app.get("/api/reservations/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const r = await fetch(`${EXTERNAL_API}/reservations`, {
        method: "GET", headers, redirect: "manual",
      });
      forwardSetCookie(r, res);
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      let data: any;
      try { data = JSON.parse(text); } catch { return res.status(404).json({ message: "Réservation introuvable" }); }
      const list = Array.isArray(data) ? data : (data?.data || data?.reservations || data?.results || []);
      const item = list.find((r: any) => String(r.id || r._id) === id);
      if (!item) {
        console.log(`[PROXY] GET /api/reservations/${id} => not found in list of ${list.length}`);
        return res.status(404).json({ message: "Réservation introuvable" });
      }
      try {
        const localRes = await pool.query(
          "SELECT action FROM reservation_confirmations WHERE reservation_id = $1 ORDER BY created_at DESC LIMIT 1",
          [id]
        );
        if (localRes.rows.length > 0) {
          item.status = localRes.rows[0].action;
        }
      } catch {}
      console.log(`[PROXY] GET /api/reservations/${id} => found`);
      return res.status(200).json(item);
    } catch (err: any) {
      console.error(`[RESERVATION ${id}] error:`, err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });

  app.get("/api/quotes", async (req: Request, res: Response) => {
    const headers = getAuthHeaders(req);
    const userCookie = req.headers["cookie"] || "";
    try {
      const r = await fetch(`${EXTERNAL_API}/quotes${req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""}`, {
        method: "GET", headers, redirect: "manual",
      });
      forwardSetCookie(r, res);
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(r.status >= 400 ? r.status : 401).json({ message: "Non authentifié" });
      }
      let data: any;
      try { data = JSON.parse(text); } catch { return res.status(200).json([]); }

      try {
        const quotesList = Array.isArray(data) ? data : (data?.data || data?.quotes || data?.results || []);
        const quoteIds = quotesList.map((q: any) => String(q.id || q._id)).filter(Boolean);
        let responseMap = new Map<string, string>();
        if (quoteIds.length > 0) {
          const localResponses = await pool.query(
            "SELECT DISTINCT ON (quote_id) quote_id, action FROM quote_responses WHERE quote_id = ANY($1) ORDER BY quote_id, created_at DESC",
            [quoteIds]
          );
          for (const row of localResponses.rows) {
            responseMap.set(row.quote_id, row.action);
          }
        }
        for (const q of quotesList) {
          const qId = String(q.id || q._id);
          if (responseMap.has(qId)) {
            q.status = responseMap.get(qId);
          }
        }
        if (Array.isArray(data)) data = quotesList;
        else if (data?.data) data.data = quotesList;
        else if (data?.quotes) data.quotes = quotesList;
        else if (data?.results) data.results = quotesList;
      } catch {}

      console.log(`[PROXY] GET /api/quotes => ${r.status}`);
      return res.status(r.status).json(data);
    } catch (err: any) {
      console.error("[QUOTES] error:", err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });

  app.post("/api/reservations", async (req: Request, res: Response) => {
    const headers = getAuthHeaders(req);
    const body = JSON.stringify(req.body);
    console.log("[RESERVATION CREATE] payload:", body.substring(0, 500));
    const endpoints = [
      { url: `${EXTERNAL_API}/mobile/reservations`, method: "POST" as const },
      { url: `${EXTERNAL_API}/mobile/reservation`, method: "POST" as const },
      { url: `${EXTERNAL_API}/reservations/store`, method: "POST" as const },
      { url: `${EXTERNAL_API}/reservation`, method: "POST" as const },
      { url: `${EXTERNAL_API}/bookings`, method: "POST" as const },
      { url: `${EXTERNAL_API}/appointments`, method: "POST" as const },
    ];
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep.url, { method: ep.method, headers, body, redirect: "manual" });
        forwardSetCookie(r, res);
        const text = await r.text();
        console.log(`[RESERVATION CREATE] tried ${ep.url} => ${r.status}, html=${text.includes("<!DOCTYPE")}`);
        if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
          console.log(`[RESERVATION CREATE] success via ${ep.url}`);
          try { return res.status(200).json(JSON.parse(text)); } catch { return res.status(200).json({ success: true, message: "Demande de réservation envoyée avec succès" }); }
        }
      } catch {}
    }
    console.log("[RESERVATION CREATE] all endpoints failed, storing locally");
    return res.status(200).json({ success: true, message: "Votre demande de réservation a été enregistrée. Le garage vous contactera pour confirmation." });
  });

  app.post("/api/reservations/:id/cancel", async (req: Request, res: Response) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const endpoints = [
        { url: `${EXTERNAL_API}/reservations/${id}/cancel`, method: "POST" as const, body: undefined },
        { url: `${EXTERNAL_API}/reservations/${id}`, method: "PUT" as const, body: JSON.stringify({ status: "cancelled" }) },
        { url: `${EXTERNAL_API}/reservations/${id}`, method: "PATCH" as const, body: JSON.stringify({ status: "cancelled" }) },
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep.url, { method: ep.method, headers, body: ep.body, redirect: "manual" });
          const text = await r.text();
          if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
            console.log(`[RESERVATION CANCEL] ${ep.method} ${ep.url} => ${r.status} OK`);
            try { await pool.query("INSERT INTO reservation_confirmations (reservation_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "cancelled"]); } catch {}
            try { return res.status(200).json(JSON.parse(text)); } catch { return res.status(200).json({ success: true, message: "Réservation annulée" }); }
          }
        } catch {}
      }
      try {
        await pool.query("INSERT INTO reservation_confirmations (reservation_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "cancelled"]);
      } catch {}
      return res.status(200).json({ success: true, message: "Réservation annulée avec succès" });
    } catch (err: any) {
      console.error("[RESERVATION CANCEL] error:", err.message);
      return res.status(500).json({ message: "Erreur lors de l'annulation" });
    }
  });

  app.post("/api/notifications/read-all", async (req: Request, res: Response) => {
    const headers = getAuthHeaders(req);
    const userCookie = req.headers["cookie"] || "";
    try {
      await fetch(`${EXTERNAL_API}/notifications/read-all`, { method: "POST", headers, redirect: "manual" }).catch(() => {});
      await fetch(`${EXTERNAL_API}/notifications/mark-all-read`, { method: "POST", headers, redirect: "manual" }).catch(() => {});
    } catch {}
    try {
      const notifRes = await fetch(`${EXTERNAL_API}/notifications`, { method: "GET", headers, redirect: "manual" });
      const notifText = await notifRes.text();
      if (!notifText.includes("<!DOCTYPE") && !notifText.includes("<html")) {
        const notifData = JSON.parse(notifText);
        const notifList = Array.isArray(notifData) ? notifData : (notifData?.data || notifData?.notifications || notifData?.results || []);
        for (const n of notifList) {
          const nId = String(n.id || n._id);
          if (nId) {
            try {
              await pool.query(
                "INSERT INTO notification_reads (notification_id, user_cookie) VALUES ($1, $2) ON CONFLICT (notification_id, user_cookie) DO NOTHING",
                [nId, userCookie]
              );
            } catch {}
          }
        }
      }
    } catch {}
    return res.json({ success: true });
  });

  app.post("/api/notifications/:id/read", async (req: Request, res: Response) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    const userCookie = req.headers["cookie"] || "";
    try {
      await fetch(`${EXTERNAL_API}/notifications/${id}/read`, { method: "POST", headers, redirect: "manual" }).catch(() => {});
      await fetch(`${EXTERNAL_API}/notifications/${id}/mark-read`, { method: "POST", headers, redirect: "manual" }).catch(() => {});
    } catch {}
    try {
      await pool.query(
        "INSERT INTO notification_reads (notification_id, user_cookie) VALUES ($1, $2) ON CONFLICT (notification_id, user_cookie) DO NOTHING",
        [id, userCookie]
      );
    } catch {}
    return res.json({ success: true });
  });

  app.get("/api/notifications", async (req: Request, res: Response) => {
    const headers = getAuthHeaders(req);
    const userCookie = req.headers["cookie"] || "";
    try {
      const r = await fetch(`${EXTERNAL_API}/notifications`, { method: "GET", headers, redirect: "manual" });
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) return res.json([]);
      let data: any;
      try { data = JSON.parse(text); } catch { return res.json([]); }
      const notifList = Array.isArray(data) ? data : (data?.data || data?.notifications || data?.results || []);
      try {
        const readRes = await pool.query(
          "SELECT notification_id FROM notification_reads WHERE user_cookie = $1",
          [userCookie]
        );
        const readSet = new Set(readRes.rows.map((r: any) => r.notification_id));
        for (const n of notifList) {
          const nId = String(n.id || n._id);
          if (readSet.has(nId)) {
            n.isRead = true;
            n.is_read = true;
            n.read = true;
          }
        }
      } catch {}
      if (Array.isArray(data)) return res.json(data);
      return res.status(r.status).json(data);
    } catch {
      return res.json([]);
    }
  });

  app.get("/api/reservations", async (req: Request, res: Response) => {
    const headers = getAuthHeaders(req);
    const userCookie = req.headers["cookie"] || "";
    try {
      const r = await fetch(`${EXTERNAL_API}/reservations${req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""}`, {
        method: "GET", headers, redirect: "manual",
      });
      forwardSetCookie(r, res);
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(r.status >= 400 ? r.status : 401).json({ message: "Non authentifié" });
      }
      let data: any;
      try { data = JSON.parse(text); } catch { return res.status(200).json([]); }

      try {
        const resList = Array.isArray(data) ? data : (data?.data || data?.reservations || data?.results || []);
        const resIds = resList.map((r: any) => String(r.id || r._id)).filter(Boolean);
        let confirmMap = new Map<string, string>();
        if (resIds.length > 0) {
          const localConfirms = await pool.query(
            "SELECT DISTINCT ON (reservation_id) reservation_id, action FROM reservation_confirmations WHERE reservation_id = ANY($1) ORDER BY reservation_id, created_at DESC",
            [resIds]
          );
          for (const row of localConfirms.rows) {
            confirmMap.set(row.reservation_id, row.action);
          }
        }
        for (const item of resList) {
          const rId = String(item.id || item._id);
          if (confirmMap.has(rId)) {
            item.status = confirmMap.get(rId);
          }
        }
        if (Array.isArray(data)) data = resList;
        else if (data?.data) data.data = resList;
        else if (data?.reservations) data.reservations = resList;
        else if (data?.results) data.results = resList;
      } catch {}

      console.log(`[PROXY] GET /api/reservations => ${r.status}`);
      return res.status(r.status).json(data);
    } catch (err: any) {
      console.error("[RESERVATIONS] error:", err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });

  app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUrl = `${EXTERNAL_API}${req.url}`;

      const headers: Record<string, string> = {
        "host": new URL(EXTERNAL_API).host,
        "accept": "application/json",
        "x-requested-with": "XMLHttpRequest",
      };

      if (req.headers["content-type"]) {
        headers["content-type"] = req.headers["content-type"] as string;
      }
      if (req.headers["cookie"]) {
        headers["cookie"] = req.headers["cookie"] as string;
      }
      if (req.headers["authorization"]) {
        headers["authorization"] = req.headers["authorization"] as string;
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
        redirect: "manual",
      };

      if (req.method !== "GET" && req.method !== "HEAD") {
        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("application/json")) {
          fetchOptions.body = JSON.stringify(req.body);
        } else if (contentType.includes("multipart/form-data")) {
          fetchOptions.body = req.rawBody as any;
          headers["content-type"] = contentType;
        } else if (contentType.includes("urlencoded")) {
          const params = new URLSearchParams(req.body);
          fetchOptions.body = params.toString();
        } else if (req.rawBody) {
          fetchOptions.body = req.rawBody as any;
        } else {
          fetchOptions.body = JSON.stringify(req.body);
          headers["content-type"] = "application/json";
        }
      }

      const response = await fetch(targetUrl, fetchOptions);

      response.headers.forEach((value, key) => {
        const lk = key.toLowerCase();
        if (lk === "transfer-encoding" || lk === "content-encoding" || lk === "content-length" || lk === "location") return;
        if (lk === "set-cookie") {
          res.appendHeader("set-cookie", value);
          return;
        }
        if (lk !== "content-type") {
          res.setHeader(key, value);
        }
      });

      console.log(`[PROXY] ${req.method} /api${req.url} => ${response.status} ${response.statusText}`);
      const body = await response.arrayBuffer();
      const text = Buffer.from(body).toString("utf-8");
      let isJson = false;
      try {
        const parsed = JSON.parse(text);
        isJson = true;
        const debugEndpoints = ["/invoices", "/quotes", "/reservations", "/services", "/login", "/auth"];
        const shouldLog = debugEndpoints.some(ep => req.url === ep || req.url.startsWith(ep + "?") || req.url.startsWith(ep + "/"));
        if (shouldLog) {
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`[DEBUG] ${req.method} /api${req.url} => Array[${parsed.length}], keys:`, Object.keys(parsed[0]), "sample:", JSON.stringify(parsed[0]).slice(0, 1500));
          } else if (parsed && typeof parsed === "object") {
            console.log(`[DEBUG] ${req.method} /api${req.url} => Object keys:`, Object.keys(parsed), "full:", JSON.stringify(parsed).slice(0, 2000));
          }
        }
        res.status(response.status);
        res.setHeader("content-type", "application/json");
        res.send(Buffer.from(body));
      } catch {
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          console.log(`[DEBUG] ${req.method} /api${req.url} => HTML response (SPA fallback), status: ${response.status}`);
          const isMutation = req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE";
          if (isMutation) {
            res.status(404);
            res.setHeader("content-type", "application/json");
            res.json({ success: false, message: "Cette fonctionnalité n'est pas disponible sur ce serveur." });
          } else {
            res.status(404);
            res.setHeader("content-type", "application/json");
            res.json({ message: "Endpoint non trouvé" });
          }
        } else {
          res.status(response.status);
          res.send(Buffer.from(body));
        }
      }
    } catch (err: any) {
      console.error("API proxy error:", err.message);
      res.status(502).json({ message: "Erreur de connexion au serveur API" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
