import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { ProjectManager } from "./project-manager";
import type { Request, Response } from "express";

const app = express();
const PORT = process.env.BUILD_SERVER_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Create HTTP server for both Express and WebSocket
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Project manager instance
const projectManager = new ProjectManager();

// Store all connected WebSocket clients with their subscriptions
const wsClients = new Map<
  any,
  { projectId: string | null; callback: ((log: any) => void) | null }
>();

// WebSocket connection for real-time logs
wss.on("connection", (ws) => {
  wsClients.set(ws, { projectId: null, callback: null });

  // Send a welcome message to confirm connection
  ws.send(
    JSON.stringify({
      type: "connected",
      message: "WebSocket connection established"
    })
  );

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "subscribe") {
        const projectId = data.projectId;
        const clientData = wsClients.get(ws);

        if (!clientData) return;

        // Unsubscribe from previous project if any
        if (clientData.callback && clientData.projectId) {
          projectManager.unsubscribeFromLogs(
            clientData.projectId,
            clientData.callback
          );
        }

        // Create a new callback for this client only
        const callback = (log: any) => {
          if (ws.readyState === 1) {
            // 1 = OPEN
            try {
              ws.send(JSON.stringify({ type: "log", data: log }));
            } catch (error) {
              console.error("Error sending to client:", error);
            }
          }
        };

        // Subscribe to project logs
        projectManager.subscribeToLogs(projectId, callback);

        // Store the subscription info
        wsClients.set(ws, { projectId, callback });

        // Send confirmation
        ws.send(
          JSON.stringify({
            type: "subscribed",
            projectId: projectId
          })
        );
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", () => {
    // Unsubscribe from logs when client disconnects
    const clientData = wsClients.get(ws);
    if (clientData?.callback && clientData.projectId) {
      projectManager.unsubscribeFromLogs(
        clientData.projectId,
        clientData.callback
      );
    }
    wsClients.delete(ws);
  });
});

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Create a new project
app.post("/api/project/create", async (req: Request, res: Response) => {
  try {
    const { name, framework, description } = req.body;

    if (!name || !framework) {
      return res
        .status(400)
        .json({ error: "Missing required fields: name, framework" });
    }

    const project = await projectManager.createProject({
      name,
      framework,
      description
    });

    res.json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Write a file to a project
app.post("/api/project/file", async (req: Request, res: Response) => {
  try {
    const { projectId, filePath, content } = req.body;

    if (!projectId || !filePath || content === undefined) {
      return res.status(400).json({
        error: "Missing required fields: projectId, filePath, content"
      });
    }

    await projectManager.writeFile(projectId, filePath, content);

    res.json({ success: true });
  } catch (error) {
    console.error("Error writing file:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Install dependencies
app.post("/api/project/install", async (req: Request, res: Response) => {
  try {
    const { projectId, packageManager = "npm" } = req.body;

    if (!projectId) {
      return res
        .status(400)
        .json({ error: "Missing required field: projectId" });
    }

    const result = await projectManager.installDependencies(
      projectId,
      packageManager
    );

    res.json(result);
  } catch (error) {
    console.error("Error installing dependencies:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Start dev server
app.post("/api/project/start", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res
        .status(400)
        .json({ error: "Missing required field: projectId" });
    }

    const result = await projectManager.startDevServer(projectId);

    res.json(result);
  } catch (error) {
    console.error("Error starting dev server:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Stop dev server
app.post("/api/project/stop", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res
        .status(400)
        .json({ error: "Missing required field: projectId" });
    }

    await projectManager.stopDevServer(projectId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error stopping dev server:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get project status
app.get(
  "/api/project/:projectId/status",
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;

      const status = await projectManager.getProjectStatus(projectId);

      res.json(status);
    } catch (error) {
      // Check if it's a "not found" error - this is expected after server restart
      const isNotFound =
        error instanceof Error && error.message.includes("not found");
      if (!isNotFound) {
        console.error("Error getting project status:", error);
      }
      res.status(isNotFound ? 404 : 500).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);

// Read a file from a project
app.get("/api/project/:projectId/file", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { path } = req.query;

    if (!path || typeof path !== "string") {
      return res
        .status(400)
        .json({ error: "Missing required query parameter: path" });
    }

    const content = await projectManager.readProjectFile(projectId, path);

    res.json({ content });
  } catch (error) {
    console.error("Error reading file:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// List all projects
app.get("/api/projects", async (_req: Request, res: Response) => {
  try {
    const projects = await projectManager.listProjects();

    res.json(projects);
  } catch (error) {
    console.error("Error listing projects:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Configure Sentry
app.post(
  "/api/project/configure-sentry",
  async (req: Request, res: Response) => {
    try {
      const { projectId, sentryDsn } = req.body;

      if (!projectId || !sentryDsn) {
        return res
          .status(400)
          .json({ error: "Missing required fields: projectId, sentryDsn" });
      }

      await projectManager.configureSentry(projectId, sentryDsn);

      res.json({ success: true });
    } catch (error) {
      console.error("Error configuring Sentry:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);

// Delete a project
app.delete("/api/project/:projectId", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    await projectManager.deleteProject(projectId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Delete all projects
app.delete("/api/projects/all", async (_req: Request, res: Response) => {
  try {
    await projectManager.deleteAllProjects();

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting all projects:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Build server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  try {
    // Unsubscribe and close all WebSocket connections
    wsClients.forEach((clientData, ws) => {
      if (clientData.callback && clientData.projectId) {
        projectManager.unsubscribeFromLogs(
          clientData.projectId,
          clientData.callback
        );
      }
      ws.close();
    });
    wsClients.clear();

    // Clean up all dev servers
    await projectManager.cleanup();

    // Close HTTP server
    server.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });

    // Force exit after 3 seconds if graceful shutdown fails
    setTimeout(() => {
      console.log("⚠️  Forcing exit after timeout");
      process.exit(1);
    }, 3000);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
