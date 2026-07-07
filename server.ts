import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

const CONFIG_FILE = path.join(process.cwd(), "supabase-config.json");

// Helper to get config
function getSupabaseServerConfig() {
  let url = process.env.VITE_SUPABASE_URL || "";
  let anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      if (fileData.url) url = fileData.url;
      if (fileData.anonKey) anonKey = fileData.anonKey;
    } catch (e) {
      console.error("Failed to read supabase-config.json:", e);
    }
  }

  return { url, anonKey };
}

// Helper to save config
function saveSupabaseServerConfig(url: string, anonKey: string) {
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }, null, 2),
      "utf-8"
    );
    // Also update process env for consistency
    process.env.VITE_SUPABASE_URL = url.trim();
    process.env.VITE_SUPABASE_ANON_KEY = anonKey.trim();
    return true;
  } catch (e) {
    console.error("Failed to write supabase-config.json:", e);
    return false;
  }
}

// API Routes
app.get("/api/supabase-config", (req, res) => {
  const config = getSupabaseServerConfig();
  res.json(config);
});

app.post("/api/save-supabase-config", (req, res) => {
  const { url, anonKey } = req.body;
  const success = saveSupabaseServerConfig(url || "", anonKey || "");
  if (success) {
    res.json({ success: true, message: "Configuration saved to server successfully" });
  } else {
    res.status(500).json({ success: false, message: "Failed to save configuration on server" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
