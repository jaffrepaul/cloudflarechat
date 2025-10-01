# Quick Start Guide

## Starting the App

```bash
# Clean start (recommended if you had issues before)
npm run cleanup
npm start
```

The app will start:
- **Main UI**: http://localhost:3000
- **Build Server**: http://localhost:3001 (internal)

## Stopping the App

Press **Ctrl+C once** and wait 2-3 seconds for graceful shutdown.

If it hangs with "Force killing..." message, press **Ctrl+C again** to force quit.

## If Processes Get Stuck

```bash
# Option 1: Use npm cleanup script
npm run cleanup

# Option 2: Use the shell script
/tmp/kill-dev-servers.sh

# Option 3: Manual cleanup
pkill -9 -f "tsx watch build-server"
pkill -9 -f "vite dev"
lsof -ti:3000,3001,3002 | xargs kill -9
```

## Common Issues

### "WebSocket errors on page load"
- **Cause**: Build server is still starting up
- **Fix**: Wait 5-10 seconds, the WebSocket will auto-reconnect
- **How to verify**: Check browser console for "✅ WebSocket connected successfully"

### "Process didn't exit in 5s. Force killing.."
- **Cause**: Dev server processes aren't responding to SIGTERM
- **Fix**: Press Ctrl+C again to force quit, then run `npm run cleanup`
- **Prevention**: Use the updated `npm start` which includes `--kill-others` flag

### "Port already in use"
- **Cause**: Previous processes didn't clean up
- **Fix**: Run `npm run cleanup` before starting

### "Projects don't appear in UI"
- **Cause**: Build server still loading or no projects created yet
- **Fix**: 
  1. Check http://localhost:3000/api/projects returns data
  2. If empty, ask the AI to create a project
  3. Projects are stored in `./projects/` directory

### "Preview iframe shows nothing"
- **Cause**: Dev server for that project isn't running
- **Fix**: 
  1. Select the project in the UI
  2. The app will auto-start the dev server
  3. Check the Logs tab for startup progress

## Development Workflow

1. **Start the app**: `npm start`
2. **Open browser**: http://localhost:3000
3. **Chat with AI**: Ask it to build an app (e.g., "Build me a React todo app")
4. **View in real-time**:
   - **Preview tab**: See the live app
   - **Logs tab**: See build/dev server output
   - **Sentry tab**: Configure Sentry integration
5. **Stop when done**: Ctrl+C

## Project Structure

```
cloudflarechat/
├── src/                    # Main UI (React app)
├── build-server/           # Project build & management server
├── projects/              # Generated apps stored here
│   └── todo-app-321e07/   # Example: auto-generated project
├── package.json           # Scripts and dependencies
└── vite.config.ts         # Vite + proxy configuration
```

## Port Allocation

- **3000**: Main UI (Vite dev server)
- **3001**: Build server + WebSocket
- **3002-3100**: Generated project dev servers (auto-allocated)

## Tips

- The WebSocket may show connection errors during startup - this is normal, it will auto-reconnect
- Each project gets its own dev server on a unique port
- Projects persist in the `./projects/` directory
- The build server auto-loads existing projects on startup
- Use the cleanup script if you ever have stuck processes

## Next Steps

Open http://localhost:3000 and try:
- "Build me a React todo app with Sentry"
- "Create a Vue.js calculator"
- "Make a Svelte contact form"

The AI will handle project creation, dependency installation, and starting the dev server automatically!
