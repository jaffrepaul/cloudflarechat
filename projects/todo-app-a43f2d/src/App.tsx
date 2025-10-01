import { useState } from 'react'
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
      title: 'It looks like we\'re having issues.',
      subtitle: 'Our team has been notified.',
      subtitle2: 'If you\'d like to help, tell us what happened below.',
    })
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>todo-app</h1>
        <p>A React-based Todo application with Sentry error tracking and performance monitoring</p>
        
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

export default App