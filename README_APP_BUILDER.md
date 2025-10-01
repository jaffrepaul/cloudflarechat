# AI App Builder with Sentry Integration

An AI-powered application builder that creates full-stack web applications with integrated Sentry monitoring for error tracking, performance monitoring, session replay, and logs.

## 🎯 Features

- **AI-Powered App Generation**: Describe what you want, and the AI builds it for you
- **Multiple Frameworks**: React, Vue, Svelte, Angular, Laravel (React fully implemented)
- **Sentry Integration**: Automatic setup for error tracking, performance monitoring, session replay, and logs
- **Live Preview**: See your app running in real-time in a split-screen interface
- **Real-time Logs**: WebSocket-powered build logs as your app is created
- **Project Gallery**: Manage multiple projects with easy switching
- **Demo Controls**: Built-in buttons to test Sentry integration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn
- A Sentry account (free tier works: https://sentry.io)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   
   Create a `.dev.vars` file in the root:
   ```bash
   OPENAI_API_KEY=sk-...
   BUILD_SERVER_PORT=3001
   BUILD_SERVER_URL=http://localhost:3001
   ```

3. **Start the application**
   ```bash
   npm start
   ```
   
   This starts two servers:
   - **Main app** (Vite): http://localhost:5173
   - **Build server**: http://localhost:3001

### Usage

1. **Open the app** at http://localhost:5173

2. **Ask the AI to build an app**
   ```
   "Build me a todo app"
   ```

3. **Create a Sentry project**
   - Go to https://sentry.io
   - Create a new project (choose React)
   - Copy the DSN

4. **Provide the DSN to the AI**
   - Paste the DSN in the chat
   - The AI will configure Sentry automatically

5. **Watch your app come to life!**
   - The right panel shows your app as it builds
   - Switch between Preview, Code, Sentry, and Logs tabs
   - Once ready, test the demo buttons

## 🎨 UI Features

### Split-Screen Layout
- **Left Panel**: AI chat interface
- **Right Panel**: Live app preview with tabs
- **Resizable**: Drag the divider to adjust sizes

### OutputPanel Tabs

#### 📱 Preview
- Live iframe of your running app
- Interact with the app directly
- Open in new tab option

#### 📝 Code
- Project information
- Feature list
- Next steps guide

#### 🐛 Sentry
- Configuration status
- Enabled features (Error tracking, Performance, Session Replay, Logs)
- DSN information
- Testing guide

#### 📊 Logs
- Real-time build logs
- Color-coded by level (info, success, warn, error)
- Timestamps for each entry

### Project Gallery
- Click the folder icon to see all projects
- Switch between projects
- See project status at a glance

## 🛠️ How It Works

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│  - Chat Interface                                    │
│  - OutputPanel with Tabs                            │
│  - WebSocket for real-time logs                     │
└───────────────────┬─────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
┌────────▼────────┐   ┌────────▼────────┐
│  Cloudflare     │   │  Build Server   │
│  Workers + AI   │   │  (Node.js)      │
│  - Chat Agent   │   │  - File Ops     │
│  - Tools        │   │  - npm install  │
└─────────────────┘   │  - Dev Servers  │
                      └─────────────────┘
                              │
                      ┌───────▼────────┐
                      │   /projects    │
                      │  Generated Apps│
                      └────────────────┘
```

### AI Tools

1. **createApp**: Initializes project structure from templates
2. **writeProjectFile**: Writes individual files (not typically used directly)
3. **installDependencies**: Runs npm install with progress updates
4. **startDevServer**: Launches Vite/framework dev server
5. **configureSentry**: Injects Sentry DSN into configuration files

### Template System

Templates are located in `/build-server/templates/`

Each template includes:
- `package.json` with dependencies
- Framework configuration files
- Sentry integration file with placeholders
- Demo components with test buttons
- Styling

Placeholders are replaced during project creation:
- `{{PROJECT_NAME}}`: The app name
- `{{DESCRIPTION}}`: App description
- `{{SENTRY_DSN}}`: Sentry configuration (empty until configured)

## 🎯 Demo Workflow

### Full End-to-End Example

**User**: "Build me a todo app with Sentry monitoring"

**AI Response**:
```
That sounds great! I'll build a React todo app with Sentry monitoring for you.

Before we begin, you'll need to create a Sentry project to enable error 
tracking and performance monitoring.

Please:
1. Go to https://sentry.io and create a new project
2. Choose 'React' as the platform
3. Copy the DSN (it looks like: https://xxx@xxx.ingest.sentry.io/xxx)
4. Paste it here

Once you provide the DSN, I'll build everything!
```

**User**: [pastes Sentry DSN]

**AI Response**:
```
Perfect! Let me build your todo app now...

✓ Creating project structure...
✓ Generating React components...
✓ Configuring Sentry (error tracking + performance + session replay + logs)...
✓ Installing dependencies (this may take a minute)...
✓ Starting development server...

🎉 Your app is live! Check out the preview on the right.

Try clicking the 'Trigger Error' button to see Sentry capture it in real-time!
```

### Testing Sentry Integration

Once the app is running:

1. **Click "🐛 Trigger Error"** in the preview
   - An error is thrown
   - Check Sentry dashboard - error appears with full stack trace

2. **Click "🐢 Slow API Call"**
   - Simulates a 2-second API call
   - Check Sentry Performance tab for transaction data

3. **Click "💬 User Feedback"**
   - Opens Sentry's feedback dialog
   - Users can report issues directly

4. **Navigate around the app**
   - All interactions are recorded
   - Session Replay captures everything
   - View playback in Sentry dashboard

## 🔧 Configuration

### Port Management

Dev servers are allocated ports from 3000-3100 automatically. If you need to change this:

Edit `build-server/project-manager.ts`:
```typescript
const PORT_RANGE_START = 3000;
const PORT_RANGE_END = 3100;
```

### Build Server URL

In development, the build server runs on `localhost:3001`. To change:

1. Update `.env`:
   ```bash
   BUILD_SERVER_PORT=3002
   BUILD_SERVER_URL=http://localhost:3002
   ```

2. Update `src/tools.ts`:
   ```typescript
   const BUILD_SERVER_URL = process.env.BUILD_SERVER_URL || 'http://localhost:3002';
   ```

## 📁 Project Structure

```
cloudflarechat/
├── src/                          # Frontend (React + Cloudflare Workers)
│   ├── components/
│   │   ├── output-panel/         # OutputPanel with tabs
│   │   ├── gallery/              # Project gallery
│   │   └── ...
│   ├── hooks/
│   │   └── useProjectManager.ts  # WebSocket + project state
│   ├── app.tsx                   # Main chat interface
│   ├── tools.ts                  # AI tools for app building
│   └── server.ts                 # Cloudflare Worker + AI agent
├── build-server/                 # Local build server (Node.js)
│   ├── index.ts                  # Express server + WebSocket
│   ├── project-manager.ts        # Project lifecycle management
│   └── templates/
│       ├── react.ts              # React template
│       └── ...                   # Other framework templates
├── projects/                     # Generated apps
│   └── my-app-abc123/
│       ├── src/
│       ├── package.json
│       └── ...
└── package.json                  # Root dependencies
```

## 🐛 Troubleshooting

### Build server won't start
- Check port 3001 is available: `lsof -i :3001`
- Check for errors in terminal output

### WebSocket connection fails
- Verify build server is running
- Check browser console for errors
- Ensure no firewall blocking localhost:3001

### npm install fails in generated project
- Check internet connection
- Look at Logs tab for npm error output
- Try manually: `cd projects/my-app-xxx && npm install`

### Preview shows blank page
- Wait for "Starting development server..." to complete (~30s)
- Check Logs tab for errors
- Verify port is accessible: open `http://localhost:3000` directly

### AI doesn't use tools
- Verify OPENAI_API_KEY is set correctly
- Check browser console and server logs for errors
- Try refreshing the page

## 🚧 Known Limitations (MVP)

1. **Framework Support**: Only React fully implemented (Vue, Svelte, Angular, Laravel templates pending)
2. **Manual Sentry Setup**: User must create Sentry project manually (automatic creation coming in future)
3. **No Project Persistence**: Projects lost on server restart (database integration planned)
4. **Single User**: No authentication or multi-user support
5. **Local Only**: Build server must run locally (cloud deployment planned)

## 🎯 Future Enhancements

### Short-term
- [ ] Vue, Svelte, Angular, Laravel templates
- [ ] Project persistence (SQLite)
- [ ] Stop/restart dev servers from UI
- [ ] Delete projects from gallery

### Mid-term
- [ ] Automatic Sentry project creation via API
- [ ] Real-time Sentry event feed in UI
- [ ] Custom project templates
- [ ] Environment variable management
- [ ] Multi-user support with auth

### Long-term
- [ ] Deploy to Cloudflare Pages from UI
- [ ] GitHub integration
- [ ] Custom dependency installation
- [ ] Code editing in browser
- [ ] Collaborative editing

## 📚 Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)

## 🤝 Contributing

This is currently an MVP. Contributions welcome!

## 📄 License

MIT

---

**Happy Building! 🚀**

If you encounter any issues, check the logs in the terminal and the Logs tab in the UI.
