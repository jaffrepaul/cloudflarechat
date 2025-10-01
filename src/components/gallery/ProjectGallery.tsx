import { Card } from '@/components/card/Card';
import { Button } from '@/components/button/Button';
import type { Project } from '@/components/output-panel/OutputPanel';
import { FolderOpen, Play, Stop, Trash, CaretLeft, CaretRight } from '@phosphor-icons/react';

interface ProjectGalleryProps {
  projects: Project[];
  activeProject?: Project;
  onSelectProject: (project: Project) => void;
  onDeleteProject?: (projectId: string) => void;
  onToggle?: () => void;
  isOpen?: boolean;
}

export function ProjectGallery({ 
  projects, 
  activeProject, 
  onSelectProject,
  onDeleteProject,
  onToggle,
  isOpen = true
}: ProjectGalleryProps) {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-900">
      {/* Header with toggle */}
      <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Projects</h2>
        <button
          className="rounded-full h-8 w-8 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          onClick={onToggle}
          title={isOpen ? "Hide projects" : "Show projects"}
          aria-label={isOpen ? "Hide projects" : "Show projects"}
        >
          {isOpen ? <CaretLeft size={20} /> : <CaretRight size={20} />}
        </button>
      </div>

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
            className={`p-3 cursor-pointer transition-all hover:border-[#F48120] ${
              activeProject?.id === project.id 
                ? 'border-[#F48120] bg-[#F48120]/5' 
                : ''
            }`}
            onClick={() => onSelectProject(project)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-sm">{project.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">
                  {project.framework}
                  {project.status && ` • ${getStatusText(project.status)}`}
                </p>
              </div>
              
              <div className="flex items-center gap-1">
                {project.status === 'ready' && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                )}
                {project.status === 'error' && (
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                )}
                {['creating', 'installing', 'starting'].includes(project.status || '') && (
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
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
          </Card>
        ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusText(status: Project['status']): string {
  switch (status) {
    case 'creating': return 'Creating...';
    case 'installing': return 'Installing...';
    case 'starting': return 'Starting...';
    case 'ready': return 'Ready';
    case 'error': return 'Error';
    default: return '';
  }
}
