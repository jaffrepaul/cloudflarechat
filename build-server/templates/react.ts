export const reactTemplate = {
  'package.json': `{
  "name": "{{PROJECT_NAME}}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "description": "{{DESCRIPTION}}",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@sentry/react": "^8.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^7.13.1",
    "@typescript-eslint/parser": "^7.13.1",
    "@vitejs/plugin-react": "^4.3.1",
    "eslint": "^8.57.0",
    "eslint-plugin-react-hooks": "^4.6.2",
    "eslint-plugin-react-refresh": "^0.4.7",
    "typescript": "^5.2.2",
    "vite": "^5.3.1"
  }
}`,

  'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: true
  }
})`,

  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`,

  'tsconfig.node.json': `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}`,

  'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{PROJECT_NAME}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,

  '.env.example': `# Sentry Configuration
# Get your DSN from https://sentry.io
VITE_SENTRY_DSN=your-sentry-dsn-here
`,

  '.gitignore': `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Environment variables (includes Sentry DSN)
.env
.env.local
.env.*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?`,

  'src/sentry.ts': `import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions for testing
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
  });
} else {
  console.warn('Sentry DSN not configured. Set VITE_SENTRY_DSN in .env file.');
}

export default Sentry;`,

  'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './sentry.ts' // Initialize Sentry

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,

  'src/App.tsx': `import { useState } from 'react'
import * as Sentry from '@sentry/react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const triggerError = () => {
    throw new Error('This is a test error for Sentry!')
  }

  const triggerSlowTransaction = async () => {
    setLoading(true)
    const transaction = Sentry.startTransaction({
      name: 'slow-api-call',
      op: 'http.client',
    })

    // Simulate a slow API call
    await new Promise(resolve => setTimeout(resolve, 2000))

    transaction.finish()
    setLoading(false)
  }

  const showFeedbackDialog = () => {
    Sentry.showReportDialog({
      title: 'It looks like we\\'re having issues.',
      subtitle: 'Our team has been notified.',
      subtitle2: 'If you\\'d like to help, tell us what happened below.',
    })
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>{{PROJECT_NAME}}</h1>
        <p>{{DESCRIPTION}}</p>
        
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
        </div>

        <div className="demo-section">
          <h2>🎯 Sentry Demo Controls</h2>
          <p className="demo-description">
            Test Sentry integration with the buttons below
          </p>
          
          <div className="demo-buttons">
            <button 
              onClick={triggerError}
              className="error-button"
              title="Trigger a test error"
            >
              🐛 Trigger Error
            </button>
            
            <button 
              onClick={triggerSlowTransaction}
              className="perf-button"
              disabled={loading}
              title="Simulate a slow API call"
            >
              {loading ? '⏳ Loading...' : '🐢 Slow API Call'}
            </button>
            
            <button 
              onClick={showFeedbackDialog}
              className="feedback-button"
              title="Open user feedback dialog"
            >
              💬 User Feedback
            </button>
          </div>

          <div className="sentry-info">
            <p>
              <strong>Note:</strong> Make sure to configure your Sentry DSN in <code>src/sentry.ts</code>
            </p>
          </div>
        </div>
      </header>
    </div>
  )
}

export default App`,

  'src/App.css': `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.App-header {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
}

.card {
  padding: 2em;
}

.demo-section {
  margin-top: 3rem;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.demo-section h2 {
  margin-top: 0;
  font-size: 1.5rem;
}

.demo-description {
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 1.5rem;
}

.demo-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.demo-buttons button {
  font-size: 1rem;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  border: 1px solid transparent;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s;
}

.error-button {
  background-color: #dc2626;
  color: white;
}

.error-button:hover {
  background-color: #b91c1c;
}

.perf-button {
  background-color: #f59e0b;
  color: white;
}

.perf-button:hover:not(:disabled) {
  background-color: #d97706;
}

.perf-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.feedback-button {
  background-color: #3b82f6;
  color: white;
}

.feedback-button:hover {
  background-color: #2563eb;
}

.sentry-info {
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 6px;
  font-size: 0.85rem;
}

.sentry-info code {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}`,

  'src/index.css': `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;
}
a:hover {
  color: #535bf2;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #646cff;
}
button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
  a:hover {
    color: #747bff;
  }
  button {
    background-color: #f9f9f9;
  }
}`
};
