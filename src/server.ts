import { routeAgentRequest, type Schedule } from "agents";

import { getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
// Workers AI Provider (uncomment if switching back to Workers AI)
// import { createWorkersAI } from "workers-ai-provider";
// AI Providers - All route through AI Gateway for analytics
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Dynamically selects a model from different providers
   * This creates diverse analytics in Cloudflare AI Gateway
   */
  private selectModel(
    openai: ReturnType<typeof createOpenAI>,
    anthropic: ReturnType<typeof createAnthropic> | null,
    google: ReturnType<typeof createGoogleGenerativeAI> | null
  ) {
    const messageCount = this.messages.length;

    // Check for tool calls (complex tasks)
    const hasToolCalls = this.messages.some((msg) =>
      msg.parts?.some((part) => part.type === "tool-call")
    );

    const random = Math.random();

    // Define available model options with their capabilities
    const modelOptions = [
      // OpenAI Models
      {
        provider: "openai",
        model: "gpt-4o-2024-11-20",
        capability: "high",
        weight: 0.25
      },
      {
        provider: "openai",
        model: "gpt-4o-mini",
        capability: "medium",
        weight: 0.2
      },
      {
        provider: "openai",
        model: "gpt-4-turbo",
        capability: "high",
        weight: 0.15
      },
      {
        provider: "openai",
        model: "gpt-3.5-turbo",
        capability: "low",
        weight: 0.1
      }
    ];

    // Add Anthropic if available
    if (anthropic) {
      modelOptions.push(
        {
          provider: "anthropic",
          model: "claude-3-5-sonnet-20241022",
          capability: "high",
          weight: 0.2
        },
        {
          provider: "anthropic",
          model: "claude-3-5-haiku-20241022",
          capability: "medium",
          weight: 0.1
        }
      );
    }

    // Add Google if available
    if (google) {
      modelOptions.push(
        {
          provider: "google",
          model: "gemini-2.0-flash-exp",
          capability: "high",
          weight: 0.15
        },
        {
          provider: "google",
          model: "gemini-1.5-flash",
          capability: "medium",
          weight: 0.1
        }
      );
    }

    // Normalize weights
    const totalWeight = modelOptions.reduce((sum, opt) => sum + opt.weight, 0);
    const normalizedOptions = modelOptions.map((opt) => ({
      ...opt,
      weight: opt.weight / totalWeight
    }));

    // Filter models based on task complexity
    let availableModels = normalizedOptions;
    if (hasToolCalls) {
      // For complex tasks, prefer high capability models
      availableModels = normalizedOptions.filter(
        (opt) => opt.capability === "high"
      );
    }

    // Select model using weighted random selection
    let cumulativeWeight = 0;
    const selectedOption =
      availableModels.find((opt) => {
        cumulativeWeight += opt.weight;
        return random < cumulativeWeight;
      }) || availableModels[0]; // Fallback to first option

    console.log(
      `🤖 Selected: ${selectedOption.provider}/${selectedOption.model} (messages: ${messageCount}, tools: ${hasToolCalls})`
    );

    // Return the appropriate model instance
    switch (selectedOption.provider) {
      case "anthropic":
        return anthropic!(selectedOption.model);
      case "google":
        return google!(selectedOption.model);
      default:
        return openai(selectedOption.model);
    }
  }

  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    // ========== AI PROVIDER CONFIGURATION ==========
    // Initialize OpenAI (always available)
    const openai = createOpenAI({
      apiKey: this.env.OPENAI_API_KEY,
      baseURL: this.env.OPENAI_GATEWAY_URL // Routes through AI Gateway
    });

    // Initialize Anthropic if API key is available
    const anthropic = this.env.ANTHROPIC_API_KEY
      ? createAnthropic({
          apiKey: this.env.ANTHROPIC_API_KEY,
          baseURL: this.env.ANTHROPIC_GATEWAY_URL // Routes through AI Gateway
        })
      : null;

    // Initialize Google if API key is available
    const google = this.env.GOOGLE_API_KEY
      ? createGoogleGenerativeAI({
          apiKey: this.env.GOOGLE_API_KEY,
          baseURL: this.env.GOOGLE_GATEWAY_URL // Routes through AI Gateway
        })
      : null;

    // Dynamic model selection across all providers for rich analytics
    const model = this.selectModel(openai, anthropic, google);

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        const result = streamText({
          system: `You are a helpful, friendly assistant that can build web applications with Sentry monitoring integration.

## Core Capabilities

1. **Building Applications**: You can create full-stack web applications using React, Vue, Svelte, Angular, or Laravel
2. **Sentry Integration**: All apps include Sentry for error tracking, performance monitoring, session replay, and logs
3. **Development Servers**: Apps are automatically started with live development servers
4. **Task Scheduling**: You can schedule tasks for later execution

## Application Building Workflow

When a user requests an application:

1. **Greet warmly** and confirm what you're building
2. **Use createApp** to initialize the project with the appropriate framework
3. **Explain the setup**: Mention that Sentry integration is included but needs configuration
4. **Ask for Sentry DSN**: Request the user to create a Sentry project and provide the DSN
   - Guide them: "Please create a new project in your Sentry account and paste the DSN here"
   - Explain benefits: error tracking, performance monitoring, session replay, and logs
5. **Use configureSentry** once they provide the DSN
6. **Use installDependencies** to install packages (this takes ~30-60 seconds)
   - Provide encouraging updates: "Installing dependencies, this may take a minute..."
7. **Use startDevServer** to launch the application
8. **Celebrate success**: "Your app is ready! Check the preview on the right →"
9. **Guide them**: Explain the demo buttons (Trigger Error, Slow API Call, User Feedback)

## Communication Style

- Be **enthusiastic** and **encouraging**
- Use **emojis** sparingly (✓, 🎉, 🚀) to show progress
- Provide **brief status updates** during long operations
- Be **polite** when asking for information
- **Celebrate** when things work

## Example Flow

User: "Build me a todo app"

You: "That sounds great! I'll build a React todo app with Sentry monitoring for you. 

Before we begin, you'll need to create a Sentry project to enable error tracking and performance monitoring. 

Please:
1. Go to https://sentry.io and create a new project
2. Choose 'React' as the platform
3. Copy the DSN (it looks like: https://xxx@xxx.ingest.sentry.io/xxx)
4. Paste it here

Once you provide the DSN, I'll build everything!"

User: [provides DSN]

You: "Perfect! Let me build your todo app now...

✓ Creating project structure...
✓ Generating React components...
✓ Configuring Sentry (error tracking + performance + session replay + logs)...
✓ Installing dependencies (this may take a minute)...
✓ Starting development server...

🎉 Your app is live! Check out the preview on the right. 

Try clicking the 'Trigger Error' button to see Sentry capture it in real-time!"

${getSchedulePrompt({ date: new Date() })}

## Supported Frameworks

- **React**: Modern React with Vite (recommended)
- **Vue**: Vue 3 with Vite  
- **Svelte**: SvelteKit
- **Angular**: Angular CLI
- **Laravel**: PHP/Laravel backend

## Important Notes

- All generated apps include demo buttons to test Sentry integration
- Apps run on ports 3000-3100 automatically
- The preview appears in the right panel
- Sentry DSN must be provided before the app can be fully functional
`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/check-open-ai-key") {
      // OpenAI: Check if API key exists
      const hasOpenAIKey = !!env.OPENAI_API_KEY;
      return Response.json({
        success: hasOpenAIKey
      });

      // Workers AI: Uncomment this when using Workers AI
      // return Response.json({
      //   success: !!env.AI
      // });
    }

    // OpenAI: Warn if API key is missing
    if (!env.OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
    }

    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
