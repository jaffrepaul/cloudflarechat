import { Card } from "@/components/card/Card";
import { Button } from "@/components/button/Button";
import type { Project } from "@/components/output-panel/OutputPanel";
import {
  FolderOpen,
  Trash,
  CaretLeft,
  CaretRight,
  TrashSimple
} from "@phosphor-icons/react";
import { useState } from "react";

interface ProjectGalleryProps {
  projects: Project[];
  activeProject?: Project;
  onSelectProject: (project: Project) => void;
  onDeleteProject?: (projectId: string) => void;
  onDeleteAllProjects?: () => void;
  onClearHistory?: () => void;
  onToggle?: () => void;
  isOpen?: boolean;
}

export function ProjectGallery({
  projects,
  activeProject,
  onSelectProject,
  onDeleteProject,
  onDeleteAllProjects,
  onClearHistory,
  onToggle,
  isOpen = true
}: ProjectGalleryProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteAll = () => {
    if (onDeleteAllProjects) {
      onDeleteAllProjects();
      // Also clear the chat history
      if (onClearHistory) {
        onClearHistory();
      }
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-900">
      {/* Header with toggle */}
      <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Projects</h2>
        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <button
              className="rounded-full h-8 w-8 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete all projects"
              aria-label="Delete all projects"
            >
              <Trash size={18} />
            </button>
          )}
          <button
            className="rounded-full h-8 w-8 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            onClick={onToggle}
            title={isOpen ? "Hide projects" : "Show projects"}
            aria-label={isOpen ? "Hide projects" : "Show projects"}
          >
            {isOpen ? <CaretLeft size={20} /> : <CaretRight size={20} />}
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 bg-white dark:bg-neutral-900">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <Trash size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    Delete All Projects?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This will delete {projects.length}{" "}
                    {projects.length === 1 ? "project" : "projects"}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This action will permanently delete all projects, stop all dev
                servers, remove all files, and clear the chat history. This
                cannot be undone.
              </p>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteAll}>
                  Delete All
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Projects list */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-8 text-center">
            <FolderOpen size={48} className="mx-auto mb-4 text-neutral-400" />
            <h3 className="text-base font-semibold mb-2">No Projects Yet</h3>
            <p className="text-xs text-muted-foreground">
              Ask the AI to build an app and it will appear here
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {projects.map((project) => (
              <Card
                key={project.id}
                className={`p-3 transition-all group relative ${
                  activeProject?.id === project.id
                    ? "border-[#F48120] bg-[#F48120]/5"
                    : ""
                }`}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => onSelectProject(project)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{project.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">
                        {project.framework}
                        {project.status &&
                          ` • ${getStatusText(project.status)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {project.status === "ready" && (
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                      )}
                      {project.status === "error" && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                      )}
                      {["creating", "installing", "starting"].includes(
                        project.status || ""
                      ) && (
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                      )}

                      {onDeleteProject && (
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(
                                `Delete "${project.name}"? This cannot be undone.`
                              )
                            ) {
                              onDeleteProject(project.id);
                            }
                          }}
                          title="Delete project"
                          aria-label="Delete project"
                        >
                          <TrashSimple size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {project.devServerUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <a
                        href={project.devServerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#F48120] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open in new tab
                      </a>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusText(status: Project["status"]): string {
  switch (status) {
    case "creating":
      return "Creating...";
    case "installing":
      return "Installing...";
    case "starting":
      return "Starting...";
    case "ready":
      return "Ready";
    case "error":
      return "Error";
    default:
      return "";
  }
}
