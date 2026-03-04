import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import pg from "pg";

const EXTERNAL_API = "https://appmyjantes1.mytoolsgroup.eu";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
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

      const userRes = await fetch(`${EXTERNAL_API}/api/auth/user`, {
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
        await fetch(`${EXTERNAL_API}/api/admin/users/${userId}`, {
          method: "DELETE",
          headers: { ...headers, "content-type": "application/json" },
          redirect: "manual",
        });
      } catch {}

      try {
        await fetch(`${EXTERNAL_API}/api/logout`, {
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

      const targetUrl = `${EXTERNAL_API}/api/login`;
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

      response.headers.forEach((value, key) => {
        const lk = key.toLowerCase();
        if (lk === "transfer-encoding" || lk === "content-encoding" || lk === "content-length") return;
        if (lk === "set-cookie") {
          res.appendHeader("set-cookie", value);
          return;
        }
        res.setHeader(key, value);
      });

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
                await fetch(`${EXTERNAL_API}/api/logout`, {
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

  app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUrl = `${EXTERNAL_API}/api${req.url}`;

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
          console.log(`[DEBUG] ${req.method} /api${req.url} => HTML response, status: ${response.status}`);
          const isRedirect = response.status >= 300 && response.status < 400;
          const isMutation = req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE";
          const isSuccess = response.status >= 200 && response.status < 300;
          if (isRedirect || (isSuccess && isMutation)) {
            res.status(200);
            res.setHeader("content-type", "application/json");
            res.json({ success: true, message: "Opération effectuée avec succès" });
          } else if (isSuccess && req.method === "GET") {
            res.status(200);
            res.setHeader("content-type", "application/json");
            res.json({});
          } else {
            res.status(response.status >= 400 ? response.status : 500);
            res.setHeader("content-type", "application/json");
            res.json({ message: "Erreur du serveur" });
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
