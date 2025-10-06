import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/card/Card";
import {
  Monitor,
  Code,
  BugBeetle,
  Terminal,
  Link as LinkIcon,
  CheckCircle
} from "@phosphor-icons/react";

export interface Project {
  id: string;
  name: string;
  framework: string;
  description?: string;
  status?: "creating" | "installing" | "starting" | "ready" | "error";
  devServerUrl?: string;
  sentryDsn?: string;
  sentryConfigured?: boolean;
  port?: number;
  files?: string[];
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "error" | "success" | "warn";
  message: string;
  projectId: string;
}

interface OutputPanelProps {
  project?: Project;
  logs?: LogEntry[];
  connected?: boolean;
}

type TabType = "preview" | "code" | "sentry" | "logs";

export function OutputPanel({
  project,
  logs = [],
  connected = false
}: OutputPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("preview");
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Switch to preview tab when project becomes ready
  useEffect(() => {
    if (project?.status === "ready" && project?.devServerUrl) {
      setActiveTab("preview");
    }
  }, [project?.status, project?.devServerUrl]);

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  if (!project) {
    return (
      <div className="h-full w-full flex flex-col bg-neutral-50 dark:bg-[#1a1626] border-l border-neutral-300 dark:border-[#9A5CF5]/20">
        {/* Main content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <div className="text-6xl animate-pulse">👨‍🍳</div>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
              Let's get cooking
            </h2>
            <p className="text-muted-foreground">
              Ask me to build an app and it will appear here
            </p>
          </div>
        </div>

        {/* Dev server logs section - always visible */}
        <div className="h-64 border-t border-neutral-300 dark:border-[#9A5CF5]/20 bg-[#241b2f] overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-[#9A5CF5]/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-300">
                Build Logs
              </h3>
              {connected ? (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <span className="w-2 h-2 bg-red-400 rounded-full" />
                  Disconnected
                </span>
              )}
            </div>
            <span className="text-xs text-neutral-500">
              {logs.length} {logs.length === 1 ? "log" : "logs"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
            {logs.length > 0 ? (
              <div className="space-y-1">
                {logs.slice(-50).map((log, index) => (
                  <div
                    key={`${log.timestamp}-${index}`}
                    className={`flex gap-3 ${
                      log.level === "error"
                        ? "text-red-400"
                        : log.level === "success"
                          ? "text-green-400"
                          : log.level === "warn"
                            ? "text-yellow-400"
                            : "text-neutral-300"
                    }`}
                  >
                    <span className="text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="uppercase text-xs font-bold w-16 whitespace-nowrap">
                      [{log.level}]
                    </span>
                    <span className="flex-1 break-words">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            ) : (
              <div className="text-neutral-500 text-sm">
                <p>Waiting for build process to start...</p>
                <p className="mt-2 text-xs">
                  Build logs and dev server output will appear here once you
                  request an app.
                </p>
                <p className="mt-4 text-xs text-neutral-600">
                  💡 Tip: Ask the AI to "build me a React todo app" to get
                  started
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-neutral-50 dark:bg-neutral-950 border-l border-neutral-300 dark:border-neutral-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-300 dark:border-[#9A5CF5]/20 bg-white dark:bg-[#241b2f]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base">{project.name}</h2>
            <p className="text-xs text-muted-foreground">
              {project.framework} • {getStatusText(project.status)}
            </p>
          </div>
          {project.devServerUrl && (
            <a
              href={project.devServerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[#F48120] hover:underline"
            >
              <LinkIcon size={16} />
              Open in new tab
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-300 dark:border-[#9A5CF5]/20 bg-white dark:bg-[#241b2f]">
        <TabButton
          icon={<Monitor size={16} />}
          label="Preview"
          active={activeTab === "preview"}
          onClick={() => setActiveTab("preview")}
          disabled={!project.devServerUrl}
        />
        <TabButton
          icon={<Code size={16} />}
          label="Code"
          active={activeTab === "code"}
          onClick={() => setActiveTab("code")}
        />
        <TabButton
          icon={<BugBeetle size={16} />}
          label="Sentry"
          active={activeTab === "sentry"}
          onClick={() => setActiveTab("sentry")}
          badge={project.sentryConfigured}
        />
        <TabButton
          icon={<Terminal size={16} />}
          label="Logs"
          active={activeTab === "logs"}
          onClick={() => setActiveTab("logs")}
          badge={logs.length > 0}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "preview" && <PreviewTab project={project} />}
        {activeTab === "code" && <CodeTab project={project} />}
        {activeTab === "sentry" && <SentryTab project={project} />}
        {activeTab === "logs" && <LogsTab logs={logs} projectId={project.id} />}
      </div>
    </div>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
  disabled = false,
  badge = false
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors relative
        ${
          active
            ? "border-[#9A5CF5] text-[#9A5CF5]"
            : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {icon}
      {label}
      {badge && (
        <span className="w-2 h-2 bg-[#9A5CF5] rounded-full absolute top-1 right-1" />
      )}
    </button>
  );
}

function PreviewTab({ project }: { project: Project }) {
  const [iframeKey, setIframeKey] = useState(0);
  const [showIframe, setShowIframe] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasInitializedRef = useRef(false);

  // Show iframe immediately when we have a devServerUrl and status is ready
  useEffect(() => {
    if (!project.devServerUrl || !project.status) {
      hasInitializedRef.current = false;
      setShowIframe(false);
      return;
    }

    // Only initialize once when status becomes ready
    if (project.status === "ready" && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // Small delay to ensure dev server is ready
      const timer = setTimeout(() => {
        setShowIframe(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [project.devServerUrl, project.status]);

  // Reset when URL changes
  useEffect(() => {
    hasInitializedRef.current = false;
    setShowIframe(false);
  }, [project.devServerUrl]);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  if (!project.devServerUrl) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="text-4xl">⏳</div>
          <h3 className="font-semibold text-lg">Starting dev server...</h3>
          <p className="text-sm text-muted-foreground">
            Your app will appear here shortly
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white dark:bg-[#1a1626] relative">
      {/* Loading state - show while waiting for iframe to be ready */}
      {!showIframe && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-[#1a1626] z-30">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-[#9A5CF5] border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <h3 className="font-semibold text-lg mb-2">Loading preview...</h3>
              <p className="text-xs text-muted-foreground mt-2">
                Preparing dev server...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Refresh button overlay - only show when iframe is visible */}
      {showIframe && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#2d2438] border border-neutral-300 dark:border-[#9A5CF5]/30 rounded-md shadow-sm hover:bg-neutral-50 dark:hover:bg-[#362d41] transition-colors text-sm"
            title="Refresh preview"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            Refresh
          </button>
        </div>
      )}

      {/* Only render iframe once triggered */}
      {showIframe && (
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={project.devServerUrl}
          className="w-full h-full border-0"
          title={`Preview: ${project.name}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"
          allow="cross-origin-isolated"
        />
      )}
    </div>
  );
}

function CodeTab({ project }: { project: Project }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const files = project.files || [];

  // Group files by directory
  const fileTree = files.reduce(
    (acc, file) => {
      const parts = file.split("/");
      const dir = parts.length > 1 ? parts[0] : "root";
      if (!acc[dir]) {
        acc[dir] = [];
      }
      acc[dir].push(file);
      return acc;
    },
    {} as Record<string, string[]>
  );

  const loadFileContent = async (filePath: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/project/${project.id}/file?path=${encodeURIComponent(filePath)}`
      );
      if (response.ok) {
        const data = (await response.json()) as { content: string };
        setFileContent(data.content);
        setSelectedFile(filePath);
      }
    } catch (error) {
      console.error("Failed to load file:", error);
      setFileContent("// Error loading file");
    } finally {
      setLoading(false);
    }
  };

  // Auto-select first source file on mount
  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      // Try to find a main source file
      const mainFile =
        files.find(
          (f) =>
            f.includes("src/App.tsx") ||
            f.includes("src/App.ts") ||
            f.includes("src/main.tsx") ||
            f.includes("src/index.tsx")
        ) || files[0];
      loadFileContent(mainFile);
    }
  }, [files.length]);

  if (files.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="text-4xl">📁</div>
          <h3 className="font-semibold text-lg">No files available</h3>
          <p className="text-sm text-muted-foreground">
            Project files will appear here once the project is created
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* File Browser */}
      <div className="w-64 border-r border-neutral-300 dark:border-[#9A5CF5]/20 overflow-y-auto bg-white dark:bg-[#241b2f]">
        <div className="p-3 border-b border-neutral-300 dark:border-[#9A5CF5]/20">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Files ({files.length})
          </h3>
        </div>
        <div className="p-2">
          {Object.entries(fileTree).map(([dir, dirFiles]) => (
            <div key={dir} className="mb-2">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-2 py-1 uppercase">
                {dir}
              </div>
              {dirFiles.map((file) => {
                const fileName = file.split("/").pop() || file;
                const isSelected = selectedFile === file;
                return (
                  <button
                    key={file}
                    onClick={() => loadFileContent(file)}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded transition-colors ${
                      isSelected
                        ? "bg-[#9A5CF5]/10 text-[#9A5CF5] font-medium"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#2d2438]"
                    }`}
                  >
                    {fileName}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Code Viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            <div className="px-4 py-2 border-b border-neutral-300 dark:border-[#9A5CF5]/20 bg-neutral-50 dark:bg-[#241b2f] flex items-center justify-between">
              <span className="text-sm font-mono text-neutral-700 dark:text-neutral-300">
                {selectedFile}
              </span>
              {loading && (
                <span className="text-xs text-neutral-500">Loading...</span>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-neutral-50 dark:bg-[#1a1626]">
              <pre className="p-4 text-sm font-mono text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words">
                {fileContent}
              </pre>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-2">
              <Code size={48} className="mx-auto text-neutral-400" />
              <p className="text-sm text-muted-foreground">
                Select a file to view its contents
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SentryTab({ project }: { project: Project }) {
  if (!project.sentryConfigured) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-4xl">🔧</div>
          <h3 className="font-semibold text-lg">Sentry Not Configured</h3>
          <p className="text-sm text-muted-foreground">
            Provide a Sentry DSN in the chat to enable error tracking,
            performance monitoring, session replay, and logs for this project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500" />
            Sentry Configured
          </h3>
          <Card className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              This project is integrated with Sentry for comprehensive
              monitoring.
            </p>

            <div className="pt-2 border-t border-neutral-200 dark:border-[#9A5CF5]/20">
              <h4 className="text-sm font-medium mb-2">Enabled Features:</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>Error Tracking</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>Performance Monitoring</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>Session Replay</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>Logs & Breadcrumbs</span>
                </li>
              </ul>
            </div>

            {project.sentryDsn && (
              <div className="pt-2 border-t border-neutral-200 dark:border-[#9A5CF5]/20">
                <h4 className="text-sm font-medium mb-2">DSN:</h4>
                <code className="text-xs bg-neutral-100 dark:bg-[#2d2438] p-2 rounded block break-all">
                  {project.sentryDsn}
                </code>
              </div>
            )}
          </Card>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Test Sentry Integration</h3>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Use the demo buttons in the Preview tab to test Sentry:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="font-medium">🐛 Trigger Error:</span>
                <span className="text-muted-foreground">
                  Throws a test error to verify error tracking
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium">🐢 Slow API Call:</span>
                <span className="text-muted-foreground">
                  Simulates slow performance for monitoring
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium">💬 User Feedback:</span>
                <span className="text-muted-foreground">
                  Opens the Sentry feedback dialog
                </span>
              </li>
            </ul>
          </Card>
        </div>

        <div>
          <h3 className="font-semibold mb-2">View in Sentry</h3>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Check your Sentry dashboard to see captured events, performance
              data, and session replays.
            </p>
            <a
              href="https://sentry.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[#9A5CF5] hover:underline"
            >
              <LinkIcon size={16} />
              Open Sentry Dashboard
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LogsTab({ logs, projectId }: { logs: LogEntry[]; projectId: string }) {
  const projectLogs = logs.filter((log) => log.projectId === projectId);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [projectLogs.length]);

  if (projectLogs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="text-4xl">📝</div>
          <h3 className="font-semibold text-lg">No logs yet</h3>
          <p className="text-sm text-muted-foreground">
            Build logs will appear here as your project is created
          </p>
        </div>
      </div>
    );
  }

  // Count log levels
  const errorCount = projectLogs.filter((l) => l.level === "error").length;
  const warnCount = projectLogs.filter((l) => l.level === "warn").length;
  const successCount = projectLogs.filter((l) => l.level === "success").length;

  return (
    <div className="h-full flex flex-col bg-[#241b2f]">
      {/* Log Stats Header */}
      <div className="px-4 py-2 border-b border-[#9A5CF5]/20 flex items-center justify-between bg-[#2d2438]">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-neutral-400">
            Total:{" "}
            <span className="text-white font-medium">{projectLogs.length}</span>
          </span>
          {successCount > 0 && (
            <span className="text-green-400">
              Success: <span className="font-medium">{successCount}</span>
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-yellow-400">
              Warnings: <span className="font-medium">{warnCount}</span>
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-red-400">
              Errors: <span className="font-medium">{errorCount}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Live
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        <div className="space-y-1">
          {projectLogs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              className={`flex gap-3 ${
                log.level === "error"
                  ? "text-red-400"
                  : log.level === "success"
                    ? "text-green-400"
                    : log.level === "warn"
                      ? "text-yellow-400"
                      : "text-neutral-300"
              }`}
            >
              <span className="text-neutral-500 text-xs whitespace-nowrap">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="uppercase text-xs font-bold w-16 whitespace-nowrap">
                [{log.level}]
              </span>
              <span className="flex-1 break-words">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

function getStatusText(status?: Project["status"]): string {
  switch (status) {
    case "creating":
      return "Creating project...";
    case "installing":
      return "Installing dependencies...";
    case "starting":
      return "Starting dev server...";
    case "ready":
      return "Ready";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}
