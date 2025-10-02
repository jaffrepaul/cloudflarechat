import { randomBytes } from 'crypto';
import { mkdir, writeFile, readdir, stat, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { reactTemplate } from './templates/react.js';

const PROJECTS_DIR = resolve(process.cwd(), 'projects');
const PORT_RANGE_START = 3002; // Start at 3002 to avoid conflicts with main app (3000) and build server (3001)
const PORT_RANGE_END = 3100;

interface Project {
  id: string;
  name: string;
  framework: string;
  description?: string;
  path: string;
  createdAt: string;
}

interface ProjectStatus {
  id: string;
  name: string;
  framework: string;
  description?: string;
  status?: 'creating' | 'installing' | 'starting' | 'ready' | 'error';
  running: boolean;
  port?: number;
  url?: string;
  devServerUrl?: string;
  files?: string[];
  sentryConfigured: boolean;
}

type LogCallback = (log: LogEntry) => void;

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'success' | 'warn';
  message: string;
  projectId: string;
}

export class ProjectManager {
  private projects: Map<string, Project> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private ports: Map<string, number> = new Map();
  private usedPorts: Set<number> = new Set();
  private logSubscriptions: Map<string, Set<LogCallback>> = new Map();

  constructor() {
    this.init();
  }

  private async init() {
    // Ensure projects directory exists
    if (!existsSync(PROJECTS_DIR)) {
      await mkdir(PROJECTS_DIR, { recursive: true });
    }
    
    // Clean up any orphaned dev server processes from previous runs
    await this.cleanupOrphanedProcesses();
    
    // Load existing projects from disk
    await this.loadProjectsFromDisk();
  }

  private async cleanupOrphanedProcesses() {
    try {
      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);
      
      // Kill any processes on our port range that might be orphaned
      for (let port = PORT_RANGE_START; port <= Math.min(PORT_RANGE_START + 10, PORT_RANGE_END); port++) {
        try {
          await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
        } catch {
          // Ignore errors - port might not be in use
        }
      }
      console.log('🧹 Cleaned up orphaned processes');
    } catch (error) {
      console.error('Error cleaning up orphaned processes:', error);
    }
  }

  private async loadProjectsFromDisk() {
    try {
      if (!existsSync(PROJECTS_DIR)) {
        return;
      }

      const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const projectPath = join(PROJECTS_DIR, entry.name);
        const packageJsonPath = join(projectPath, 'package.json');
        
        if (!existsSync(packageJsonPath)) continue;
        
        try {
          const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
          
          // Use directory name as stable ID (just the suffix after last dash)
          const match = entry.name.match(/-([a-f0-9]+)$/);
          const id = match ? match[1] : this.generateId();
          
          const project: Project = {
            id,
            name: packageJson.name || entry.name,
            framework: this.detectFramework(packageJson),
            description: packageJson.description,
            path: projectPath,
            createdAt: (await stat(projectPath)).birthtime.toISOString()
          };
          
          this.projects.set(id, project);
          console.log(`📂 Loaded existing project: ${project.name} (${id})`);
        } catch (error) {
          console.error(`Failed to load project from ${entry.name}:`, error);
        }
      }
      
      console.log(`✅ Loaded ${this.projects.size} existing project(s)`);
    } catch (error) {
      console.error('Error loading projects from disk:', error);
    }
  }

  private detectFramework(packageJson: any): string {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps['react']) return 'react';
    if (deps['vue']) return 'vue';
    if (deps['svelte']) return 'svelte';
    if (deps['@angular/core']) return 'angular';
    if (deps['laravel']) return 'laravel';
    
    return 'react'; // default
  }

  private generateId(): string {
    return randomBytes(8).toString('hex');
  }

  private allocatePort(): number {
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    throw new Error('No available ports in range');
  }

  private releasePort(port: number) {
    this.usedPorts.delete(port);
  }

  private log(projectId: string, level: LogEntry['level'], message: string) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      projectId
    };

    // Only log errors to server console to reduce noise
    if (level === 'error') {
      console.log(`[${projectId}] ${level.toUpperCase()}: ${message}`);
    }

    // Notify all subscribers
    const subscribers = this.logSubscriptions.get(projectId);
    if (subscribers) {
      subscribers.forEach(callback => callback(logEntry));
    }
  }

  subscribeToLogs(projectId: string, callback: LogCallback) {
    if (!this.logSubscriptions.has(projectId)) {
      this.logSubscriptions.set(projectId, new Set());
    }
    this.logSubscriptions.get(projectId)!.add(callback);
  }

  unsubscribeFromLogs(projectId: string, callback: LogCallback) {
    const subscribers = this.logSubscriptions.get(projectId);
    if (subscribers) {
      subscribers.delete(callback);
    }
  }

  async createProject(params: {
    name: string;
    framework: string;
    description?: string;
  }): Promise<Project> {
    const id = this.generateId();
    const sanitizedName = params.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const projectPath = join(PROJECTS_DIR, `${sanitizedName}-${id.slice(0, 6)}`);

    this.log(id, 'info', `Creating project: ${params.name}`);

    // Create project directory
    await mkdir(projectPath, { recursive: true });

    const project: Project = {
      id,
      name: params.name,
      framework: params.framework,
      description: params.description,
      path: projectPath,
      createdAt: new Date().toISOString()
    };

    this.projects.set(id, project);
    
    // Generate project files from template
    await this.generateProjectFiles(project);
    
    this.log(id, 'success', `Project created at ${projectPath}`);

    return project;
  }

  private async generateProjectFiles(project: Project): Promise<void> {
    this.log(project.id, 'info', `Generating ${project.framework} template files...`);

    // Get the template for this framework
    const template = this.getTemplate(project.framework);
    
    if (!template) {
      throw new Error(`Template not found for framework: ${project.framework}`);
    }

    // Write each file from the template
    for (const [filePath, content] of Object.entries(template)) {
      // Replace placeholders
      let processedContent = content
        .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
        .replace(/\{\{DESCRIPTION\}\}/g, project.description || 'A new application');

      const fullPath = join(project.path, filePath);
      const dir = join(fullPath, '..');
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, processedContent, 'utf-8');
    }

    this.log(project.id, 'success', `Template files generated`);
  }

  private getTemplate(framework: string): Record<string, string> | null {
    switch (framework.toLowerCase()) {
      case 'react':
        return reactTemplate;
      // TODO: Add other frameworks
      case 'vue':
      case 'svelte':
      case 'angular':
      case 'laravel':
        throw new Error(`Template for ${framework} not yet implemented`);
      default:
        return null;
    }
  }

  async writeFile(projectId: string, filePath: string, content: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Security: ensure file is within project directory
    const fullPath = resolve(project.path, filePath);
    if (!fullPath.startsWith(project.path)) {
      throw new Error('Invalid file path: outside project directory');
    }

    this.log(projectId, 'info', `Writing file: ${filePath}`);

    // Create directory if it doesn't exist
    const dir = join(fullPath, '..');
    await mkdir(dir, { recursive: true });

    // Write file
    await writeFile(fullPath, content, 'utf-8');

    this.log(projectId, 'success', `File written: ${filePath}`);
  }

  async installDependencies(
    projectId: string,
    packageManager: string = 'npm'
  ): Promise<{ success: boolean; output: string }> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    this.log(projectId, 'info', `Installing dependencies with ${packageManager}...`);

    return new Promise((resolve, reject) => {
      const command = packageManager === 'npm' ? 'npm' : packageManager;
      const args = ['install'];

      const process = spawn(command, args, {
        cwd: project.path,
        shell: true
      });

      let output = '';
      let stdoutBuffer = '';
      let stderrBuffer = '';

      process.stdout?.on('data', (data) => {
        const message = data.toString();
        output += message;
        
        stdoutBuffer += message;
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
          const cleaned = this.cleanLogLine(line);
          if (cleaned) {
            this.log(projectId, 'info', cleaned);
          }
        }
      });

      process.stderr?.on('data', (data) => {
        const message = data.toString();
        output += message;
        
        stderrBuffer += message;
        const lines = stderrBuffer.split('\n');
        stderrBuffer = lines.pop() || '';

        for (const line of lines) {
          const cleaned = this.cleanLogLine(line);
          if (cleaned) {
            // npm warnings/errors come through stderr
            const level = this.detectLogLevel(cleaned);
            this.log(projectId, level, cleaned);
          }
        }
      });

      process.on('close', (code) => {
        if (code === 0) {
          this.log(projectId, 'success', 'Dependencies installed successfully');
          resolve({ success: true, output });
        } else {
          this.log(projectId, 'error', `Installation failed with code ${code}`);
          reject(new Error(`Installation failed with code ${code}`));
        }
      });

      process.on('error', (error) => {
        this.log(projectId, 'error', `Installation error: ${error.message}`);
        reject(error);
      });
    });
  }

  async startDevServer(projectId: string): Promise<{ port: number; url: string }> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Check if already running
    if (this.processes.has(projectId)) {
      const port = this.ports.get(projectId)!;
      return { port, url: `http://localhost:${port}` };
    }

    const port = this.allocatePort();
    this.ports.set(projectId, port);

    this.log(projectId, 'info', `Starting dev server on port ${port}...`);

    // Determine start command based on framework
    const { command, args } = this.getStartCommand(project.framework, port);

    const childProcess = spawn(command, args, {
      cwd: project.path,
      shell: true,
      detached: false, // Keep process attached so it's killed when parent dies
      env: { ...process.env, PORT: port.toString() }
    });

    this.processes.set(projectId, childProcess);

    // Buffer to handle partial lines
    let stdoutBuffer = '';
    let stderrBuffer = '';

    childProcess.stdout?.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || ''; // Keep the incomplete line in buffer

      for (const line of lines) {
        const cleaned = this.cleanLogLine(line);
        if (cleaned) {
          const level = this.detectLogLevel(cleaned);
          this.log(projectId, level, cleaned);
        }
      }
    });

    childProcess.stderr?.on('data', (data) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || ''; // Keep the incomplete line in buffer

      for (const line of lines) {
        const cleaned = this.cleanLogLine(line);
        if (cleaned) {
          // stderr might not always be errors (Vite outputs to stderr)
          const level = this.detectLogLevel(cleaned);
          this.log(projectId, level, cleaned);
        }
      }
    });

    childProcess.on('close', (code) => {
      this.log(projectId, 'info', `Dev server stopped with code ${code}`);
      this.processes.delete(projectId);
      this.releasePort(port);
      this.ports.delete(projectId);
    });

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    this.log(projectId, 'success', `Dev server running at http://localhost:${port}`);

    return { port, url: `http://localhost:${port}` };
  }

  private cleanLogLine(line: string): string {
    // Remove ANSI escape codes (colors, cursor movement, etc.)
    const cleaned = line
      .replace(/\x1b\[[0-9;]*m/g, '') // Color codes
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '') // Other ANSI codes
      .replace(/\r/g, '') // Carriage returns
      .trim();

    // Filter out empty lines and common noise
    if (!cleaned) return '';
    if (cleaned.length < 2) return '';
    
    // Filter out progress indicators and spinner characters
    if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏▀▄█]$/.test(cleaned)) return '';
    
    return cleaned;
  }

  private detectLogLevel(message: string): 'info' | 'error' | 'success' | 'warn' {
    const lower = message.toLowerCase();
    
    // Error patterns
    if (
      lower.includes('error') ||
      lower.includes('failed') ||
      lower.includes('exception') ||
      lower.includes('fatal') ||
      lower.match(/\berr\b/) ||
      lower.includes('cannot find') ||
      lower.includes('not found') && lower.includes('module')
    ) {
      return 'error';
    }
    
    // Warning patterns
    if (
      lower.includes('warn') ||
      lower.includes('warning') ||
      lower.includes('deprecated') ||
      lower.includes('conflict')
    ) {
      return 'warn';
    }
    
    // Success patterns
    if (
      lower.includes('ready') ||
      lower.includes('compiled') ||
      lower.includes('success') ||
      lower.includes('✓') ||
      lower.includes('✔') ||
      lower.match(/server.*running/) ||
      lower.match(/local.*http/) ||
      lower.includes('hmr') ||
      lower.includes('updated') && (lower.includes('.tsx') || lower.includes('.ts') || lower.includes('.jsx')) ||
      lower.includes('page reload') ||
      lower.includes('reloaded') ||
      lower.match(/\d+\s*ms\b/) && lower.includes('vite')
    ) {
      return 'success';
    }
    
    return 'info';
  }

  private getStartCommand(framework: string, port: number): { command: string; args: string[] } {
    switch (framework.toLowerCase()) {
      case 'react':
        return { command: 'npm', args: ['run', 'dev', '--', '--port', port.toString()] };
      case 'vue':
        return { command: 'npm', args: ['run', 'dev', '--', '--port', port.toString()] };
      case 'svelte':
        return { command: 'npm', args: ['run', 'dev', '--', '--port', port.toString()] };
      case 'angular':
        return { command: 'npm', args: ['start', '--', '--port', port.toString()] };
      case 'laravel':
        return { command: 'php', args: ['artisan', 'serve', '--port', port.toString()] };
      default:
        return { command: 'npm', args: ['run', 'dev'] };
    }
  }

  async stopDevServer(projectId: string): Promise<void> {
    const childProcess = this.processes.get(projectId);
    if (!childProcess) {
      return;
    }

    this.log(projectId, 'info', 'Stopping dev server...');

    const port = this.ports.get(projectId);

    // Kill the process
    if (childProcess.pid) {
      try {
        // Send SIGTERM first for graceful shutdown
        childProcess.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force kill if still running
        if (!childProcess.killed) {
          childProcess.kill('SIGKILL');
        }
      } catch (error) {
        // Process might already be dead, that's OK
      }
    }

    // Also kill any process listening on the port (backup cleanup)
    if (port) {
      try {
        const { exec } = await import('child_process');
        const util = await import('util');
        const execAsync = util.promisify(exec);
        
        // Kill process on port (macOS/Linux)
        await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
      } catch (error) {
        // Ignore errors - process might already be stopped
      }
      
      this.releasePort(port);
      this.ports.delete(projectId);
    }

    this.processes.delete(projectId);
    this.log(projectId, 'success', 'Dev server stopped');
  }

  async getProjectStatus(projectId: string): Promise<ProjectStatus> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const running = this.processes.has(projectId);
    const port = this.ports.get(projectId);

    // Check if Sentry is configured (look for sentry.ts or config files)
    const sentryConfigured = existsSync(join(project.path, 'src', 'sentry.ts')) ||
                           existsSync(join(project.path, 'sentry.config.ts'));

    // List all files in the project (recursively)
    const files = await this.listProjectFiles(project.path);

    // Determine status based on project state
    let status: 'creating' | 'installing' | 'starting' | 'ready' | 'error' = 'ready';
    if (running && port) {
      status = 'ready';
    } else {
      status = 'creating';
    }

    return {
      id: project.id,
      name: project.name,
      framework: project.framework,
      description: project.description,
      status,
      running,
      port,
      url: port ? `http://localhost:${port}` : undefined,
      devServerUrl: port ? `http://localhost:${port}` : undefined,
      files,
      sentryConfigured
    };
  }

  private async listProjectFiles(projectPath: string, relativePath = ''): Promise<string[]> {
    const files: string[] = [];
    const fullPath = join(projectPath, relativePath);

    try {
      const entries = await readdir(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip node_modules and other common directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
          continue;
        }

        const entryPath = join(relativePath, entry.name);

        if (entry.isDirectory()) {
          // Recursively list files in subdirectories
          const subFiles = await this.listProjectFiles(projectPath, entryPath);
          files.push(...subFiles);
        } else {
          files.push(entryPath);
        }
      }
    } catch (error) {
      console.error(`Error listing files in ${fullPath}:`, error);
    }

    return files;
  }

  async listProjects(): Promise<ProjectStatus[]> {
    const statuses = await Promise.all(
      Array.from(this.projects.keys()).map(id => this.getProjectStatus(id))
    );
    return statuses;
  }

  async readProjectFile(projectId: string, filePath: string): Promise<string> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Security: ensure file is within project directory
    const fullPath = resolve(join(project.path, filePath));
    if (!fullPath.startsWith(resolve(project.path))) {
      throw new Error('Invalid file path');
    }

    try {
      const content = await readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async configureSentry(projectId: string, sentryDsn: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    this.log(projectId, 'info', 'Configuring Sentry integration...');

    // Create .env file with the Sentry DSN
    const envFilePath = join(project.path, '.env');
    const envContent = `# Sentry Configuration
VITE_SENTRY_DSN=${sentryDsn}
`;

    await writeFile(envFilePath, envContent, 'utf-8');
    this.log(projectId, 'success', 'Sentry DSN configured in .env file (gitignored)');
  }

  async cleanup() {
    console.log('🧹 Cleaning up all dev servers...');
    // Stop all running processes
    const stopPromises = Array.from(this.processes.keys()).map(projectId => 
      this.stopDevServer(projectId).catch(err => 
        console.error(`Error stopping ${projectId}:`, err)
      )
    );
    await Promise.all(stopPromises);
    console.log('✅ Cleanup complete');
  }
}
