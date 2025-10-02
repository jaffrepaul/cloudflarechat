import { useState, useEffect, useCallback, useRef } from "react";
import type { Project, LogEntry } from "@/components/output-panel/OutputPanel";

const BUILD_SERVER_URL = "http://localhost:3001";
// Connect directly to build server WebSocket (bypassing Vite proxy issues)
const WS_URL = "ws://localhost:3001";

// Maximum number of log entries to keep in memory and storage
const MAX_LOGS = 500;

// Accept HMR updates for this module to prevent full page reloads
if (import.meta.hot) {
  import.meta.hot.accept();
}

// Safe sessionStorage helper with quota handling
const safeSessionStorage = {
  setItem: (key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      // If quota exceeded, clear old data and try again
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        console.warn("SessionStorage quota exceeded, clearing logs...");
        sessionStorage.removeItem("logs");
        try {
          sessionStorage.setItem(key, value);
        } catch {
          console.error(
            "Failed to save to sessionStorage even after clearing logs"
          );
        }
      }
    }
  },
  getItem: (key: string) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
};

export function useProjectManager() {
  // Load initial state from sessionStorage to survive hot reloads
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = safeSessionStorage.getItem("projects");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeProject, setActiveProject] = useState<Project | undefined>(
    () => {
      try {
        const saved = safeSessionStorage.getItem("activeProject");
        return saved ? JSON.parse(saved) : undefined;
      } catch {
        return undefined;
      }
    }
  );

  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      const saved = safeSessionStorage.getItem("logs");
      const parsed = saved ? JSON.parse(saved) : [];
      // Limit logs on load too
      return parsed.slice(-MAX_LOGS);
    } catch {
      return [];
    }
  });

  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Persist state to sessionStorage
  useEffect(() => {
    safeSessionStorage.setItem("projects", JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (activeProject) {
      safeSessionStorage.setItem(
        "activeProject",
        JSON.stringify(activeProject)
      );
    }
  }, [activeProject]);

  useEffect(() => {
    // Keep only the most recent logs to prevent storage quota issues
    const recentLogs = logs.slice(-MAX_LOGS);
    safeSessionStorage.setItem("logs", JSON.stringify(recentLogs));
  }, [logs]);

  // Fetch all projects
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch(`${BUILD_SERVER_URL}/api/projects`);
      if (response.ok) {
        const projectsData = (await response.json()) as Project[];
        setProjects(projectsData);

        // If we have an active project, update it
        if (activeProject) {
          const updated = projectsData.find(
            (p: Project) => p.id === activeProject.id
          );
          if (updated) {
            setActiveProject(updated);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  }, [activeProject]);

  // Get project status
  const getProjectStatus = useCallback(
    async (projectId: string): Promise<Project | null> => {
      try {
        const response = await fetch(
          `${BUILD_SERVER_URL}/api/project/${projectId}/status`
        );
        if (response.ok) {
          return await response.json();
        }
        // Silently handle 404s (project not found) - this is expected after server restart
        if (response.status !== 404) {
          console.error(
            "Failed to get project status:",
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        // Only log if it's not a network error (server might be starting up)
        if (error instanceof TypeError && error.message.includes("fetch")) {
          // Network error - server might be down/restarting, don't spam console
        } else {
          console.error("Failed to get project status:", error);
        }
      }
      return null;
    },
    []
  );

  // Set active project and subscribe to logs
  const setActive = useCallback((project: Project | undefined) => {
    setActiveProject(project);

    // Subscribe to project logs via WebSocket
    if (project && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "subscribe",
          projectId: project.id
        })
      );
    }
  }, []);

  // WebSocket connection - establish once on mount
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnectDelay = 10000; // Max 10 seconds between retries
    let isCleanup = false;

    const connect = () => {
      if (isCleanup) return; // Don't reconnect if we're cleaning up

      // Calculate exponential backoff delay
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttempts),
        maxReconnectDelay
      );

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          reconnectAttempts = 0; // Reset counter on successful connection
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "log") {
              // Keep only the most recent logs to prevent memory issues
              setLogs((prev) => {
                const updated = [...prev, data.data];
                return updated.slice(-MAX_LOGS);
              });
            }
            // Silently handle other message types (connected, subscribed)
          } catch (error) {
            console.error("WebSocket message error:", error);
          }
        };

        ws.onerror = () => {
          // Silently handle errors, we'll reconnect automatically
        };

        ws.onclose = () => {
          setConnected(false);

          if (isCleanup) {
            return;
          }

          reconnectAttempts++;

          // Auto-reconnect with exponential backoff
          reconnectTimer = setTimeout(connect, delay);
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        reconnectAttempts++;
        if (!isCleanup) {
          reconnectTimer = setTimeout(connect, delay);
        }
      }
    };

    // Start connection after a small delay to let build server start
    reconnectTimer = setTimeout(connect, 500);

    return () => {
      isCleanup = true;
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        // Properly close the WebSocket without trying to delete properties
        const ws = wsRef.current;
        wsRef.current = null;
        if (
          ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING
        ) {
          ws.close();
        }
      }
    };
  }, []); // Only run once on mount

  // Subscribe to project logs when active project changes
  useEffect(() => {
    if (activeProject && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "subscribe",
          projectId: activeProject.id
        })
      );
    }
  }, [activeProject]);

  // Poll for project updates - but stop polling once project is ready or errored
  useEffect(() => {
    if (!activeProject) return;

    // If project is in a stable state (ready or error), don't poll
    if (activeProject.status === "ready" || activeProject.status === "error") {
      return;
    }

    // Only poll if project is still in progress
    const interval = setInterval(() => {
      getProjectStatus(activeProject.id).then((status) => {
        if (status) {
          setActiveProject(status);
        } else {
          // Project no longer exists on backend, clear it from state
          setActiveProject(undefined);
          safeSessionStorage.setItem("activeProject", "");
        }
      });
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [activeProject, getProjectStatus]);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Delete a single project
  const deleteProject = useCallback(
    async (projectId: string) => {
      try {
        const response = await fetch(
          `${BUILD_SERVER_URL}/api/project/${projectId}`,
          {
            method: "DELETE"
          }
        );

        if (response.ok) {
          // Remove from local state
          setProjects((prev) => prev.filter((p) => p.id !== projectId));

          // Clear active project if it's the one being deleted
          if (activeProject?.id === projectId) {
            setActiveProject(undefined);
          }
        } else {
          console.error("Failed to delete project:", response.status);
        }
      } catch (error) {
        console.error("Failed to delete project:", error);
      }
    },
    [activeProject]
  );

  // Delete all projects and reset state
  const deleteAllProjects = useCallback(async () => {
    try {
      const response = await fetch(`${BUILD_SERVER_URL}/api/projects/all`, {
        method: "DELETE"
      });

      if (response.ok) {
        // Clear all state
        setProjects([]);
        setActiveProject(undefined);
        setLogs([]);

        // Clear session storage
        safeSessionStorage.setItem("projects", "[]");
        safeSessionStorage.setItem("activeProject", "");
        safeSessionStorage.setItem("logs", "[]");
      } else {
        console.error("Failed to delete all projects:", response.status);
      }
    } catch (error) {
      console.error("Failed to delete all projects:", error);
    }
  }, []);

  return {
    projects,
    activeProject,
    logs,
    connected,
    setActiveProject: setActive,
    fetchProjects,
    getProjectStatus,
    deleteProject,
    deleteAllProjects
  };
}
