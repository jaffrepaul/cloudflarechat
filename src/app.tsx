/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useState, useRef, useCallback, use } from "react";
import { useAgent } from "agents/react";
import { isToolUIPart } from "ai";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";
import type { tools } from "./tools";
import type { Project } from "@/components/output-panel/OutputPanel";

// Component imports
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Avatar } from "@/components/avatar/Avatar";
import { Toggle } from "@/components/toggle/Toggle";
import { Textarea } from "@/components/textarea/Textarea";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { OutputPanel } from "@/components/output-panel/OutputPanel";
import { ProjectGallery } from "@/components/gallery/ProjectGallery";

// Hooks
import { useProjectManager } from "@/hooks/useProjectManager";

// Icon imports
import {
  Bug,
  Moon,
  Sun,
  Trash,
  PaperPlaneTilt,
  Stop,
  FolderOpen
} from "@phosphor-icons/react";

// List of tools that require human confirmation
// NOTE: this should match the tools that don't have execute functions in tools.ts
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation"
];

export default function Chat() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Check localStorage first, default to dark if not found
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });
  const [showDebug, setShowDebug] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState("auto");
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Project management
  const {
    projects,
    activeProject,
    logs,
    connected,
    setActiveProject,
    fetchProjects,
    deleteProject,
    deleteAllProjects
  } = useProjectManager();

  // Start with gallery closed
  const [showGallery, setShowGallery] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Apply theme class on mount and when theme changes
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }

    // Save theme preference to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Scroll to bottom on mount
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const agent = useAgent({
    agent: "chat"
  });

  const [agentInput, setAgentInput] = useState("");
  const handleAgentInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setAgentInput(e.target.value);
  };

  const handleAgentSubmit = async (
    e: React.FormEvent,
    extraData: Record<string, unknown> = {}
  ) => {
    e.preventDefault();
    if (!agentInput.trim()) return;

    const message = agentInput;
    setAgentInput("");

    // Send message to agent
    await sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: message }]
      },
      {
        body: extraData
      }
    );
  };

  const {
    messages: agentMessages,
    clearHistory,
    status,
    sendMessage,
    stop
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
    agent
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    agentMessages.length > 0 && scrollToBottom();
  }, [agentMessages, scrollToBottom]);

  // Watch for tool results that create/update projects
  useEffect(() => {
    const lastMessage = agentMessages[agentMessages.length - 1];
    if (!lastMessage?.parts) return;

    // Look for createApp tool results
    for (const part of lastMessage.parts) {
      if (isToolUIPart(part) && part.type === "tool-createApp" && part.output) {
        const output = part.output as {
          success: boolean;
          projectId: string;
          projectName?: string;
          framework?: string;
        };
        if (output.success && output.projectId) {
          // Fetch updated project status
          fetchProjects();

          // Set as active project after a short delay
          setTimeout(async () => {
            // Fetch the actual project status from the API
            try {
              const response = await fetch(
                `http://localhost:3001/api/project/${output.projectId}/status`
              );
              if (response.ok) {
                const projectStatus = (await response.json()) as Project;
                setActiveProject(projectStatus);
              }
            } catch (error) {
              console.error("Failed to fetch project status:", error);
              setActiveProject({
                id: output.projectId,
                name: output.projectName || "New Project",
                framework: output.framework || "react",
                status: "creating"
              });
            }
          }, 500);
        }
      }

      // Look for startDevServer tool results
      if (
        isToolUIPart(part) &&
        part.type === "tool-startDevServer" &&
        part.output
      ) {
        const output = part.output as {
          success: boolean;
          url?: string;
          port?: number;
        };
        if (output.success && output.url) {
          // Refresh the active project from the API
          setTimeout(async () => {
            if (activeProject) {
              try {
                const response = await fetch(
                  `http://localhost:3001/api/project/${activeProject.id}/status`
                );
                if (response.ok) {
                  const projectStatus = (await response.json()) as Project;
                  setActiveProject(projectStatus);
                }
              } catch (error) {
                console.error("Failed to refresh project status:", error);
              }
            }
          }, 1000);
        }
      }

      // Look for configureSentry tool results
      if (
        isToolUIPart(part) &&
        part.type === "tool-configureSentry" &&
        part.output
      ) {
        const output = part.output as { success: boolean };
        if (output.success && activeProject) {
          setActiveProject({
            ...activeProject,
            sentryConfigured: true
          });
        }
      }
    }
  }, [agentMessages, activeProject, fetchProjects, setActiveProject]);

  const pendingToolCallConfirmation = agentMessages.some((m: UIMessage) =>
    m.parts?.some(
      (part) =>
        isToolUIPart(part) &&
        part.state === "input-available" &&
        // Manual check inside the component
        toolsRequiringConfirmation.includes(
          part.type.replace("tool-", "") as keyof typeof tools
        )
    )
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Handle mouse move for resizing
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Constrain between 30% and 70%
      if (newWidth >= 30 && newWidth <= 70) {
        setLeftPanelWidth(newWidth);
      }
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className="h-[100vh] w-full flex overflow-hidden bg-neutral-50 dark:bg-[#1a1626]"
    >
      <HasOpenAIKey />

      {/* Project Gallery Sidebar - Fixed width on left */}
      <div
        className={`h-full flex-shrink-0 transition-all duration-300 lg:block hidden ${showGallery ? "w-80" : "w-0"} overflow-hidden border-r border-neutral-300 dark:border-[#9A5CF5]/20`}
      >
        <div className="h-full w-80 bg-white dark:bg-[#241b2f]">
          <ProjectGallery
            projects={projects}
            activeProject={activeProject}
            onSelectProject={(project) => {
              setActiveProject(project);
            }}
            onDeleteProject={deleteProject}
            onDeleteAllProjects={deleteAllProjects}
            onClearHistory={clearHistory}
            onToggle={() => setShowGallery(!showGallery)}
            isOpen={showGallery}
          />
        </div>
      </div>

      {/* Left Panel - Chat Interface */}
      <div
        className="h-full flex-shrink-0 lg:block hidden"
        style={{ width: `${leftPanelWidth}%` }}
      >
        <div className="h-full w-full px-0 py-1 flex justify-center items-center">
          <div className="h-[calc(100vh-0.5rem)] w-full mx-auto max-w-5xl flex flex-col shadow-xl rounded-md overflow-hidden relative border border-neutral-300 dark:border-[#9A5CF5]/30">
            <div className="px-4 py-3 border-b border-neutral-300 dark:border-[#9A5CF5]/20 flex items-center gap-3 sticky top-0 z-10">
              {/* Toggle button when gallery is closed */}
              {!showGallery && (
                <button
                  type="button"
                  className="rounded-full h-8 w-8 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors mr-1"
                  onClick={() => setShowGallery(true)}
                  title="Show projects"
                  aria-label="Show projects"
                >
                  <FolderOpen size={20} />
                </button>
              )}

              <div className="flex items-center justify-center h-8 w-8">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 72 66"
                  width="28"
                  height="26"
                >
                  <title>Sentry</title>
                  <path
                    d="M29,2.26a4.67,4.67,0,0,0-8,0L14.42,13.53A32.21,32.21,0,0,1,32.17,40.19H27.55A27.68,27.68,0,0,0,12.09,17.47L6,28a15.92,15.92,0,0,1,9.23,12.17H4.62A.76.76,0,0,1,4,39.06l2.94-5a10.74,10.74,0,0,0-3.36-1.9l-2.91,5a4.54,4.54,0,0,0,1.69,6.24A4.66,4.66,0,0,0,4.62,44H19.15a19.4,19.4,0,0,0-8-17.31l2.31-4A23.87,23.87,0,0,1,23.76,44H36.07a35.88,35.88,0,0,0-16.41-31.8l4.67-8a.77.77,0,0,1,1.05-.27c.53.29,20.29,34.77,20.66,35.17a.76.76,0,0,1-.68,1.13H40.6q.09,1.91,0,3.81h4.78A4.59,4.59,0,0,0,50,39.43a4.49,4.49,0,0,0-.62-2.28Z"
                    transform="translate(11, 11)"
                    fill="currentColor"
                    className="text-[#362d59] dark:text-white"
                  ></path>
                </svg>
              </div>

              <div className="flex-1">
                <h2 className="font-semibold text-base">Sentry Vibes</h2>
              </div>

              <div className="flex items-center gap-2 mr-2">
                <Bug size={16} />
                <Toggle
                  toggled={showDebug}
                  aria-label="Toggle debug mode"
                  onClick={() => setShowDebug((prev) => !prev)}
                />
              </div>

              <Button
                variant="ghost"
                size="md"
                shape="square"
                className="rounded-full h-9 w-9"
                onClick={toggleTheme}
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </Button>

              <Button
                variant="ghost"
                size="md"
                shape="square"
                className="rounded-full h-9 w-9"
                onClick={clearHistory}
              >
                <Trash size={20} />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 max-h-[calc(100vh-10rem)]">
              {agentMessages.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <Card className="p-6 max-w-md mx-auto bg-neutral-100 dark:bg-[#2d2438]">
                    <div className="text-center space-y-4">
                      <div className="bg-[#362d59]/10 dark:bg-white/10 rounded-full p-3 inline-flex">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 72 66"
                          width="48"
                          height="44"
                        >
                          <title>Sentry</title>
                          <path
                            d="M29,2.26a4.67,4.67,0,0,0-8,0L14.42,13.53A32.21,32.21,0,0,1,32.17,40.19H27.55A27.68,27.68,0,0,0,12.09,17.47L6,28a15.92,15.92,0,0,1,9.23,12.17H4.62A.76.76,0,0,1,4,39.06l2.94-5a10.74,10.74,0,0,0-3.36-1.9l-2.91,5a4.54,4.54,0,0,0,1.69,6.24A4.66,4.66,0,0,0,4.62,44H19.15a19.4,19.4,0,0,0-8-17.31l2.31-4A23.87,23.87,0,0,1,23.76,44H36.07a35.88,35.88,0,0,0-16.41-31.8l4.67-8a.77.77,0,0,1,1.05-.27c.53.29,20.29,34.77,20.66,35.17a.76.76,0,0,1-.68,1.13H40.6q.09,1.91,0,3.81h4.78A4.59,4.59,0,0,0,50,39.43a4.49,4.49,0,0,0-.62-2.28Z"
                            transform="translate(11, 11)"
                            fill="currentColor"
                            className="text-[#362d59] dark:text-white"
                          ></path>
                        </svg>
                      </div>
                      <h3 className="font-semibold text-lg">
                        Welcome to Sentry Vibes
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        Start a conversation with your AI assistant.
                      </p>
                    </div>
                  </Card>
                </div>
              )}

              {agentMessages.map((m, index) => {
                const isUser = m.role === "user";
                const showAvatar =
                  index === 0 || agentMessages[index - 1]?.role !== m.role;

                return (
                  <div key={m.id}>
                    {showDebug && (
                      <pre className="text-xs text-muted-foreground overflow-scroll">
                        {JSON.stringify(m, null, 2)}
                      </pre>
                    )}
                    <div
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex gap-2 max-w-[85%] ${
                          isUser ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {showAvatar && !isUser ? (
                          <Avatar username={"AI"} />
                        ) : (
                          !isUser && <div className="w-8" />
                        )}

                        <div>
                          <div>
                            {m.parts?.map((part, i) => {
                              if (part.type === "text") {
                                return (
                                  // biome-ignore lint/suspicious/noArrayIndexKey: immutable index
                                  <div key={i}>
                                    <Card
                                      className={`p-3 rounded-md bg-neutral-100 dark:bg-[#2d2438] ${
                                        isUser
                                          ? "rounded-br-none"
                                          : "rounded-bl-none border-assistant-border"
                                      } ${
                                        part.text.startsWith(
                                          "scheduled message"
                                        )
                                          ? "border-accent/50"
                                          : ""
                                      } relative`}
                                    >
                                      {part.text.startsWith(
                                        "scheduled message"
                                      ) && (
                                        <span className="absolute -top-3 -left-2 text-base">
                                          🕒
                                        </span>
                                      )}
                                      <MemoizedMarkdown
                                        id={`${m.id}-${i}`}
                                        content={part.text.replace(
                                          /^scheduled message: /,
                                          ""
                                        )}
                                      />
                                    </Card>
                                    <p
                                      className={`text-xs text-muted-foreground mt-1 ${
                                        isUser ? "text-right" : "text-left"
                                      }`}
                                    >
                                      {formatTime(
                                        m.metadata?.createdAt
                                          ? new Date(m.metadata.createdAt)
                                          : new Date()
                                      )}
                                    </p>
                                  </div>
                                );
                              }

                              // if (isToolUIPart(part)) {
                              //   const toolCallId = part.toolCallId;
                              //   const toolName = part.type.replace("tool-", "");
                              //   const needsConfirmation =
                              //     toolsRequiringConfirmation.includes(
                              //       toolName as keyof typeof tools
                              //     );

                              //   // Skip rendering the card in debug mode
                              //   if (showDebug) return null;

                              //   return (
                              //     <ToolInvocationCard
                              //       // biome-ignore lint/suspicious/noArrayIndexKey: using index is safe here as the array is static
                              //       key={`${toolCallId}-${i}`}
                              //       toolUIPart={part}
                              //       toolCallId={toolCallId}
                              //       needsConfirmation={needsConfirmation}
                              //       onSubmit={({ toolCallId, result }) => {
                              //         addToolResult({
                              //           tool: part.type.replace("tool-", ""),
                              //           toolCallId,
                              //           output: result
                              //         });
                              //       }}
                              //       addToolResult={(toolCallId, result) => {
                              //         addToolResult({
                              //           tool: part.type.replace("tool-", ""),
                              //           toolCallId,
                              //           output: result
                              //         });
                              //       }}
                              //     />
                              //   );
                              // }
                              return null;
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAgentSubmit(e, {
                  annotations: {
                    hello: "world"
                  }
                });
                setTextareaHeight("auto"); // Reset height after submission
              }}
              className="p-3 bg-neutral-50 absolute bottom-0 left-0 right-0 z-10 border-t border-neutral-300 dark:border-[#9A5CF5]/20 dark:bg-[#241b2f]"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    disabled={pendingToolCallConfirmation}
                    placeholder={
                      pendingToolCallConfirmation
                        ? "Please respond to the tool confirmation above..."
                        : "Send a message..."
                    }
                    className="flex w-full border border-neutral-200 dark:border-[#9A5CF5]/30 px-3 py-2  ring-offset-background placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-[#9A5CF5] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1626] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base pb-10 dark:bg-[#2d2438]"
                    value={agentInput}
                    onChange={(e) => {
                      handleAgentInputChange(e);
                      // Auto-resize the textarea
                      e.target.style.height = "auto";
                      e.target.style.height = `${e.target.scrollHeight}px`;
                      setTextareaHeight(`${e.target.scrollHeight}px`);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        handleAgentSubmit(e as unknown as React.FormEvent);
                        setTextareaHeight("auto"); // Reset height on Enter submission
                      }
                    }}
                    rows={2}
                    style={{ height: textareaHeight }}
                  />
                  <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
                    {status === "submitted" || status === "streaming" ? (
                      <button
                        type="button"
                        onClick={stop}
                        className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                        aria-label="Stop generation"
                      >
                        <Stop size={16} />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                        disabled={
                          pendingToolCallConfirmation || !agentInput.trim()
                        }
                        aria-label="Send message"
                      >
                        <PaperPlaneTilt size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Resizer */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: This is a resizer handle for mouse dragging */}
      <div
        role="presentation"
        className="w-1 bg-neutral-300 dark:bg-[#9A5CF5]/20 hover:bg-[#9A5CF5] dark:hover:bg-[#9A5CF5] cursor-col-resize transition-colors lg:block hidden"
        onMouseDown={() => setIsResizing(true)}
      />

      {/* Right Panel - Output */}
      <div className="h-full flex-1 lg:block hidden">
        <OutputPanel
          project={activeProject}
          logs={logs}
          connected={connected}
        />
      </div>

      {/* Mobile View - Stack vertically */}
      <div className="lg:hidden w-full h-full flex flex-col">
        <div className="flex-1 overflow-hidden">
          <div className="h-full w-full px-0 py-1 flex justify-center items-center">
            <div className="h-[calc(100%-0.5rem)] w-full mx-auto max-w-3xl flex flex-col shadow-xl rounded-md overflow-hidden relative border border-neutral-300 dark:border-[#9A5CF5]/30">
              <div className="px-4 py-3 border-b border-neutral-300 dark:border-[#9A5CF5]/20 flex items-center gap-3 sticky top-0 z-10">
                <div className="flex items-center justify-center h-8 w-8">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 72 66"
                    width="28"
                    height="26"
                  >
                    <title>Sentry</title>
                    <path
                      d="M29,2.26a4.67,4.67,0,0,0-8,0L14.42,13.53A32.21,32.21,0,0,1,32.17,40.19H27.55A27.68,27.68,0,0,0,12.09,17.47L6,28a15.92,15.92,0,0,1,9.23,12.17H4.62A.76.76,0,0,1,4,39.06l2.94-5a10.74,10.74,0,0,0-3.36-1.9l-2.91,5a4.54,4.54,0,0,0,1.69,6.24A4.66,4.66,0,0,0,4.62,44H19.15a19.4,19.4,0,0,0-8-17.31l2.31-4A23.87,23.87,0,0,1,23.76,44H36.07a35.88,35.88,0,0,0-16.41-31.8l4.67-8a.77.77,0,0,1,1.05-.27c.53.29,20.29,34.77,20.66,35.17a.76.76,0,0,1-.68,1.13H40.6q.09,1.91,0,3.81h4.78A4.59,4.59,0,0,0,50,39.43a4.49,4.49,0,0,0-.62-2.28Z"
                      transform="translate(11, 11)"
                      fill="currentColor"
                      className="text-[#362d59] dark:text-white"
                    ></path>
                  </svg>
                </div>

                <div className="flex-1">
                  <h2 className="font-semibold text-base">Sentry Vibes</h2>
                </div>

                <div className="flex items-center gap-2 mr-2">
                  <Bug size={16} />
                  <Toggle
                    toggled={showDebug}
                    aria-label="Toggle debug mode"
                    onClick={() => setShowDebug((prev) => !prev)}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="md"
                  shape="square"
                  className="rounded-full h-9 w-9"
                  onClick={toggleTheme}
                >
                  {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                </Button>

                <Button
                  variant="ghost"
                  size="md"
                  shape="square"
                  className="rounded-full h-9 w-9"
                  onClick={clearHistory}
                >
                  <Trash size={20} />
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 max-h-[calc(100%-10rem)]">
                {agentMessages.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <Card className="p-6 max-w-md mx-auto bg-neutral-100 dark:bg-[#2d2438]">
                      <div className="text-center space-y-4">
                        <div className="bg-[#362d59]/10 dark:bg-white/10 rounded-full p-3 inline-flex">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 72 66"
                            width="48"
                            height="44"
                          >
                            <title>Sentry</title>
                            <path
                              d="M29,2.26a4.67,4.67,0,0,0-8,0L14.42,13.53A32.21,32.21,0,0,1,32.17,40.19H27.55A27.68,27.68,0,0,0,12.09,17.47L6,28a15.92,15.92,0,0,1,9.23,12.17H4.62A.76.76,0,0,1,4,39.06l2.94-5a10.74,10.74,0,0,0-3.36-1.9l-2.91,5a4.54,4.54,0,0,0,1.69,6.24A4.66,4.66,0,0,0,4.62,44H19.15a19.4,19.4,0,0,0-8-17.31l2.31-4A23.87,23.87,0,0,1,23.76,44H36.07a35.88,35.88,0,0,0-16.41-31.8l4.67-8a.77.77,0,0,1,1.05-.27c.53.29,20.29,34.77,20.66,35.17a.76.76,0,0,1-.68,1.13H40.6q.09,1.91,0,3.81h4.78A4.59,4.59,0,0,0,50,39.43a4.49,4.49,0,0,0-.62-2.28Z"
                              transform="translate(11, 11)"
                              fill="currentColor"
                              className="text-[#362d59] dark:text-white"
                            ></path>
                          </svg>
                        </div>
                        <h3 className="font-semibold text-lg">
                          Welcome to Sentry Vibes
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          Start a conversation with your AI assistant.
                        </p>
                      </div>
                    </Card>
                  </div>
                )}

                {agentMessages.map((m, index) => {
                  const isUser = m.role === "user";
                  const showAvatar =
                    index === 0 || agentMessages[index - 1]?.role !== m.role;

                  return (
                    <div key={m.id}>
                      {showDebug && (
                        <pre className="text-xs text-muted-foreground overflow-scroll">
                          {JSON.stringify(m, null, 2)}
                        </pre>
                      )}
                      <div
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`flex gap-2 max-w-[85%] ${
                            isUser ? "flex-row-reverse" : "flex-row"
                          }`}
                        >
                          {showAvatar && !isUser ? (
                            <Avatar username={"AI"} />
                          ) : (
                            !isUser && <div className="w-8" />
                          )}

                          <div>
                            <div>
                              {m.parts?.map((part, i) => {
                                if (part.type === "text") {
                                  return (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: immutable index
                                    <div key={i}>
                                      <Card
                                        className={`p-3 rounded-md bg-neutral-100 dark:bg-[#2d2438] ${
                                          isUser
                                            ? "rounded-br-none"
                                            : "rounded-bl-none border-assistant-border"
                                        } ${
                                          part.text.startsWith(
                                            "scheduled message"
                                          )
                                            ? "border-accent/50"
                                            : ""
                                        } relative`}
                                      >
                                        {part.text.startsWith(
                                          "scheduled message"
                                        ) && (
                                          <span className="absolute -top-3 -left-2 text-base">
                                            🕒
                                          </span>
                                        )}
                                        <MemoizedMarkdown
                                          id={`${m.id}-${i}`}
                                          content={part.text.replace(
                                            /^scheduled message: /,
                                            ""
                                          )}
                                        />
                                      </Card>
                                      <p
                                        className={`text-xs text-muted-foreground mt-1 ${
                                          isUser ? "text-right" : "text-left"
                                        }`}
                                      >
                                        {formatTime(
                                          m.metadata?.createdAt
                                            ? new Date(m.metadata.createdAt)
                                            : new Date()
                                        )}
                                      </p>
                                    </div>
                                  );
                                }

                                // if (isToolUIPart(part)) {
                                //   const toolCallId = part.toolCallId;
                                //   const toolName = part.type.replace("tool-", "");
                                //   const needsConfirmation =
                                //     toolsRequiringConfirmation.includes(
                                //       toolName as keyof typeof tools
                                //     );

                                //   // Skip rendering the card in debug mode
                                //   if (showDebug) return null;

                                //   return (
                                //     <ToolInvocationCard
                                //       // biome-ignore lint/suspicious/noArrayIndexKey: using index is safe here as the array is static
                                //       key={`${toolCallId}-${i}`}
                                //       toolUIPart={part}
                                //       toolCallId={toolCallId}
                                //       needsConfirmation={needsConfirmation}
                                //       onSubmit={({ toolCallId, result }) => {
                                //         addToolResult({
                                //           tool: part.type.replace("tool-", ""),
                                //           toolCallId,
                                //           output: result
                                //         });
                                //       }}
                                //       addToolResult={(toolCallId, result) => {
                                //         addToolResult({
                                //           tool: part.type.replace("tool-", ""),
                                //           toolCallId,
                                //           output: result
                                //         });
                                //       }}
                                //     />
                                //   );
                                // }
                                return null;
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAgentSubmit(e, {
                    annotations: {
                      hello: "world"
                    }
                  });
                  setTextareaHeight("auto"); // Reset height after submission
                }}
                className="p-3 bg-neutral-50 absolute bottom-0 left-0 right-0 z-10 border-t border-neutral-300 dark:border-[#9A5CF5]/20 dark:bg-[#241b2f]"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Textarea
                      disabled={pendingToolCallConfirmation}
                      placeholder={
                        pendingToolCallConfirmation
                          ? "Please respond to the tool confirmation above..."
                          : "Send a message..."
                      }
                      className="flex w-full border border-neutral-200 dark:border-[#9A5CF5]/30 px-3 py-2  ring-offset-background placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-[#9A5CF5] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1626] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base pb-10 dark:bg-[#2d2438]"
                      value={agentInput}
                      onChange={(e) => {
                        handleAgentInputChange(e);
                        // Auto-resize the textarea
                        e.target.style.height = "auto";
                        e.target.style.height = `${e.target.scrollHeight}px`;
                        setTextareaHeight(`${e.target.scrollHeight}px`);
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          handleAgentSubmit(e as unknown as React.FormEvent);
                          setTextareaHeight("auto"); // Reset height on Enter submission
                        }
                      }}
                      rows={2}
                      style={{ height: textareaHeight }}
                    />
                    <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
                      {status === "submitted" || status === "streaming" ? (
                        <button
                          type="button"
                          onClick={stop}
                          className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                          aria-label="Stop generation"
                        >
                          <Stop size={16} />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                          disabled={
                            pendingToolCallConfirmation || !agentInput.trim()
                          }
                          aria-label="Send message"
                        >
                          <PaperPlaneTilt size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const hasOpenAiKeyPromise = fetch("/check-open-ai-key").then((res) =>
  res.json<{ success: boolean }>()
);

function HasOpenAIKey() {
  const hasOpenAiKey = use(hasOpenAiKeyPromise);

  if (!hasOpenAiKey.success) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white dark:bg-[#2d2438] rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-labelledby="warningIcon"
                >
                  <title id="warningIcon">Warning Icon</title>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                  OpenAI API Key Not Configured
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 mb-1">
                  Requests to the API, including from the frontend UI, will not
                  work until an OpenAI API key is configured.
                </p>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Please configure an OpenAI API key by setting a{" "}
                  <a
                    href="https://developers.cloudflare.com/workers/configuration/secrets/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    secret
                  </a>{" "}
                  named{" "}
                  <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-sm">
                    OPENAI_API_KEY
                  </code>
                  . <br />
                  You can also use a different model provider by following these{" "}
                  <a
                    href="https://github.com/cloudflare/agents-starter?tab=readme-ov-file#use-a-different-ai-model-provider"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    instructions.
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
