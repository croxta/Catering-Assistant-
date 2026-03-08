import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "event-architect-secret";
const PORT = 3000;

// Simple "Database"
interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

interface Order {
  id: string;
  userId: string;
  eventType: string;
  groupProfile: any;
  result: string;
  finalOrder?: string;
  used: boolean;
  rating?: number;
  createdAt: string;
}

const db = {
  users: [] as User[],
  orders: [] as Order[]
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(cors());
  app.use(cookieParser());

  // --- Netlify Function Proxy (Local Development) ---
  app.post("/.netlify/functions/gemini-proxy", async (req, res) => {
    try {
      const { prompt, model, contents, config } = req.body;
      
      // Try to find a valid API key, ignoring placeholders
      const keysToTry = [
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY,
        process.env.API_KEY
      ];
      
      const apiKey = keysToTry.find(key => key && key !== "MY_GEMINI_API_KEY" && key.length > 10);
      
      if (!apiKey) {
        console.error("No valid API key found in environment variables.");
        return res.status(500).json({ 
          error: "GEMINI_API_KEY not configured. Please set it in your environment or AI Studio secrets." 
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      if (prompt && !contents) {
        const response = await ai.models.generateContent({
          model: model || "gemini-1.5-flash",
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        return res.json({ reply: response.text });
      }

      const response = await ai.models.generateContent({
        model: model || "gemini-3-flash-preview",
        contents,
        config
      });

      res.json(response);
    } catch (error: any) {
      console.error("Local Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Auth Routes ---
  
  // Mock Google Auth for demo purposes since we don't have real client IDs
  // In a real app, this would be the OAuth callback handler
  app.post("/api/auth/google", (req, res) => {
    const { email, name, picture } = req.body;
    
    let user = db.users.find(u => u.email === email);
    if (!user) {
      user = {
        id: Math.random().toString(36).substring(7),
        email,
        name,
        picture,
        role: email === 'himrock77@gmail.com' ? 'admin' : 'user', // Make requester admin
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
    }
    
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user, token });
  });

  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = db.users.find(u => u.id === decoded.userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      res.json(user);
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  // --- Order Routes ---

  app.post("/api/orders", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const { eventType, groupProfile, result } = req.body;
      
      const order: Order = {
        id: Math.random().toString(36).substring(7),
        userId: decoded.userId,
        eventType,
        groupProfile,
        result,
        used: false,
        createdAt: new Date().toISOString()
      };
      
      db.orders.push(order);
      res.json(order);
    } catch (e) {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.get("/api/orders", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const userOrders = db.orders.filter(o => o.userId === decoded.userId);
      res.json(userOrders);
    } catch (e) {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.patch("/api/orders/:id", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const { used, rating, finalOrder } = req.body;
      const order = db.orders.find(o => o.id === req.params.id && o.userId === decoded.userId);
      
      if (!order) return res.status(404).json({ error: "Order not found" });
      
      if (used !== undefined) order.used = used;
      if (rating !== undefined) order.rating = rating;
      if (finalOrder !== undefined) order.finalOrder = finalOrder;
      
      res.json(order);
    } catch (e) {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  // --- Admin Routes ---

  app.get("/api/admin/stats", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
      
      res.json({
        totalUsers: db.users.length,
        totalOrders: db.orders.length,
        users: db.users,
        orders: db.orders
      });
    } catch (e) {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.get("/api/admin/report", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
      
      // Generate CSV
      let csv = "Type,ID,Email/User,Event,Created,Used,Rating\n";
      
      db.users.forEach(u => {
        csv += `USER,${u.id},${u.email},N/A,${u.createdAt},N/A,N/A\n`;
      });
      
      db.orders.forEach(o => {
        const user = db.users.find(u => u.id === o.userId);
        csv += `ORDER,${o.id},${user?.email || 'Unknown'},${o.eventType},${o.createdAt},${o.used},${o.rating || 'N/A'}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
      res.send(csv);
    } catch (e) {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.get("/api/admin/users/download", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
      
      let csv = "ID,Name,Email,Role,CreatedAt\n";
      db.users.forEach(u => {
        csv += `${u.id},${u.name},${u.email},${u.role},${u.createdAt}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users_report.csv');
      res.send(csv);
    } catch (e) {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.get("/api/admin/orders/download", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
      
      let csv = "ID,UserID,UserEmail,EventType,CreatedAt,Used,Rating\n";
      db.orders.forEach(o => {
        const user = db.users.find(u => u.id === o.userId);
        csv += `${o.id},${o.userId},${user?.email || 'Unknown'},${o.eventType},${o.createdAt},${o.used},${o.rating || 'N/A'}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=orders_report.csv');
      res.send(csv);
    } catch (e) {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
