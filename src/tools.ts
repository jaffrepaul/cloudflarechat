/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";

// Build server URL - direct connection to build server
const BUILD_SERVER_URL =
  process.env.BUILD_SERVER_URL || "http://localhost:3001";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() })
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  inputSchema: z.object({ location: z.string() }),
  execute: async () => {
    return "10am";
  }
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

/**
 * Tool to create a new application project
 */
const createApp = tool({
  description:
    "Create a new application project with the specified framework and configuration",
  inputSchema: z.object({
    name: z.string().describe("The name of the application"),
    framework: z
      .enum(["react", "vue", "svelte", "angular", "laravel"])
      .describe("The framework to use"),
    description: z
      .string()
      .optional()
      .describe("A brief description of what the app does")
  }),
  execute: async ({ name, framework, description }) => {
    try {
      const response = await fetch(`${BUILD_SERVER_URL}/api/project/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, framework, description })
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error || "Failed to create project");
      }

      const project = (await response.json()) as {
        id: string;
        name: string;
        framework: string;
        path: string;
      };
      return {
        success: true,
        projectId: project.id,
        projectName: project.name,
        framework: project.framework,
        path: project.path,
        message: `Project "${name}" created successfully with ${framework}`
      };
    } catch (error) {
      console.error("Error creating app:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
});

/**
 * Tool to write a file to a project
 */
const writeProjectFile = tool({
  description: "Write a file to a project directory",
  inputSchema: z.object({
    projectId: z.string().describe("The ID of the project"),
    filePath: z
      .string()
      .describe("The relative path of the file within the project"),
    content: z.string().describe("The content to write to the file")
  }),
  execute: async ({ projectId, filePath, content }) => {
    try {
      const response = await fetch(`${BUILD_SERVER_URL}/api/project/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, filePath, content })
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error || "Failed to write file");
      }

      return {
        success: true,
        message: `File ${filePath} written successfully`
      };
    } catch (error) {
      console.error("Error writing file:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
});

/**
 * Tool to install dependencies for a project
 */
const installDependencies = tool({
  description: "Install npm dependencies for a project",
  inputSchema: z.object({
    projectId: z.string().describe("The ID of the project"),
    packageManager: z
      .enum(["npm", "yarn", "pnpm"])
      .optional()
      .describe("The package manager to use (defaults to npm)")
  }),
  execute: async ({ projectId, packageManager = "npm" }) => {
    try {
      const response = await fetch(`${BUILD_SERVER_URL}/api/project/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, packageManager })
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error || "Failed to install dependencies");
      }

      const result = (await response.json()) as { success: boolean };
      return {
        success: result.success,
        message: "Dependencies installed successfully"
      };
    } catch (error) {
      console.error("Error installing dependencies:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
});

/**
 * Tool to start a development server for a project
 */
const startDevServer = tool({
  description: "Start the development server for a project",
  inputSchema: z.object({
    projectId: z.string().describe("The ID of the project")
  }),
  execute: async ({ projectId }) => {
    try {
      const response = await fetch(`${BUILD_SERVER_URL}/api/project/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId })
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error || "Failed to start dev server");
      }

      const result = (await response.json()) as { port: number; url: string };
      return {
        success: true,
        port: result.port,
        url: result.url,
        message: `Dev server started at ${result.url}`
      };
    } catch (error) {
      console.error("Error starting dev server:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
});

/**
 * Tool to configure Sentry for a project
 * This requires the user to provide a Sentry DSN
 */
const configureSentry = tool({
  description:
    "Configure Sentry monitoring for a project with the provided DSN",
  inputSchema: z.object({
    projectId: z.string().describe("The ID of the project"),
    sentryDsn: z.string().describe("The Sentry DSN to use for this project")
  }),
  execute: async ({ projectId, sentryDsn }) => {
    try {
      const response = await fetch(
        `${BUILD_SERVER_URL}/api/project/configure-sentry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, sentryDsn })
        }
      );

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error || "Failed to configure Sentry");
      }

      return {
        success: true,
        message:
          "Sentry configured successfully with error tracking, performance monitoring, session replay, and logs"
      };
    } catch (error) {
      console.error("Error configuring Sentry:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  createApp,
  writeProjectFile,
  installDependencies,
  startDevServer,
  configureSentry
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    return `The weather in ${city} is sunny`;
  }
};
