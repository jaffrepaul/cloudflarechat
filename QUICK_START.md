# 🚀 Quick Start Guide

Get your AI App Builder running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment

Create `.dev.vars` file:

```bash
OPENAI_API_KEY=sk-your-key-here
```

## Step 3: Start the App

```bash
npm start
```

You should see:

```
🚀 Build server running on http://localhost:3001
📡 WebSocket server ready

VITE v5.x.x ready in xxx ms

➜  Local:   http://localhost:5173/
```

## Step 4: Build Your First App

1. **Open** http://localhost:5173 in your browser

2. **Chat with the AI**:

   ```
   Build me a todo app
   ```

3. **The AI will respond**:

   ```
   That sounds great! I'll build a React todo app with Sentry monitoring.

   Before we begin, please:
   1. Go to https://sentry.io and create a new project
   2. Choose 'React' as the platform
   3. Copy the DSN
   4. Paste it here
   ```

4. **Create a Sentry Project**:
   - Go to https://sentry.io (sign up if needed)
   - Click "Create Project"
   - Select "React" as the platform
   - Name it anything (e.g., "My Todo App")
   - Copy the DSN (looks like: `https://abc123@o123.ingest.sentry.io/456`)

5. **Paste the DSN** in the chat

6. **Watch the magic happen!** ✨
   - Project creation
   - Sentry configuration
   - Dependency installation (~1 minute)
   - Dev server startup
   - Live preview appears on the right!

## Step 5: Test Sentry Integration

In the preview panel (right side):

1. Click **"🐛 Trigger Error"**
   - Check your Sentry dashboard
   - The error appears with full stack trace!

2. Click **"🐢 Slow API Call"**
   - Check Sentry Performance tab
   - See the 2-second transaction

3. Click **"💬 User Feedback"**
   - Sentry feedback dialog appears
   - Submit feedback
   - View in Sentry dashboard

## 🎉 You're Done!

Your app is running with full Sentry integration including:

- ✅ Error tracking
- ✅ Performance monitoring
- ✅ Session replay
- ✅ Logs & breadcrumbs

## 💡 Tips

- **Switch tabs** in the right panel to see Code, Sentry info, and Logs
- **Click the folder icon** (top left) to see all your projects
- **Build multiple apps** - each gets its own port and Sentry project
- **Open in new tab** - click the link icon to open apps separately

## 🐛 Troubleshooting

**Build server won't start?**

```bash
# Check if port 3001 is in use
lsof -i :3001
# Kill it if needed
kill -9 <PID>
```

**WebSocket errors?**

- Refresh the page
- Check build server is running

**npm install fails?**

- Check internet connection
- Look at the Logs tab for errors

**Need help?**

- Check `README_APP_BUILDER.md` for detailed docs
- Check `IMPLEMENTATION_STATUS.md` for architecture details

---

**Happy building! 🚀**
