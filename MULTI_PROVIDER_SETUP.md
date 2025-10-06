# Multi-Provider AI Model Rotation

Your app now **automatically rotates** between multiple AI providers (OpenAI, Anthropic, Google) to generate rich analytics in Cloudflare AI Gateway! 🎉

## What's Working Now

### ✅ Currently Active

- **OpenAI GPT Models**: 4 models rotating automatically
  - `gpt-4o-2024-11-20` (30% of requests)
  - `gpt-4o-mini` (30% of requests)
  - `gpt-4-turbo` (25% of requests)
  - `gpt-3.5-turbo` (15% of requests)

### 🔧 Ready to Enable (Optional)

- **Anthropic Claude Models**: 2 models available
  - `claude-3-5-sonnet-20241022` (high capability)
  - `claude-3-5-haiku-20241022` (fast & economical)

- **Google Gemini Models**: 2 models available
  - `gemini-2.0-flash-exp` (high capability)
  - `gemini-1.5-flash` (fast & economical)

## How It Works

The system uses **intelligent model selection**:

1. **Complexity Detection**:
   - Tasks with tool calls → uses high-capability models (GPT-4o, Claude Sonnet, Gemini 2.0)
   - Simple queries → mixes between all models for variety

2. **Weighted Distribution**:
   - Models are selected using weighted random selection
   - More capable models get higher weights for complex tasks
   - Faster, economical models get used for simpler queries

3. **Console Logs**:
   ```
   🤖 Selected: openai/gpt-4o-mini (messages: 2, tools: false)
   🤖 Selected: anthropic/claude-3-5-sonnet-20241022 (messages: 5, tools: true)
   🤖 Selected: google/gemini-2.0-flash-exp (messages: 1, tools: false)
   ```

## Analytics Dashboard

View all your model usage at:
**https://dash.cloudflare.com → AI → AI Gateway → `cf-chat`**

You'll see:

- 📊 **Model Distribution** across providers
- 💰 **Cost Comparison** (OpenAI vs Anthropic vs Google)
- ⚡ **Performance Metrics** (latency by provider)
- 📈 **Request Volume** over time
- 🔍 **Token Usage** breakdown

## Adding More Providers

### Anthropic (Claude)

1. Get API key: https://console.anthropic.com
2. Update `.dev.vars`:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ANTHROPIC_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/c8476387145c8fc0d78c43da7600fd8f/cf-chat/anthropic
   ```
3. Restart the app: `npm start`

### Google (Gemini)

1. Get API key: https://makersuite.google.com/app/apikey
2. Update `.dev.vars`:
   ```bash
   GOOGLE_API_KEY=your-google-key-here
   GOOGLE_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/c8476387145c8fc0d78c43da7600fd8f/cf-chat/google-ai-studio
   ```
3. Restart the app: `npm start`

## Customizing the Rotation

Want to adjust which models are used? Edit `src/server.ts`:

```typescript
// Line 48-54: Define your model pool
const modelOptions = [
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
  }
  // Add or remove models here
];
```

**Weight**: Higher numbers = more likely to be selected (they're normalized automatically)

## Deployment

For production, upload secrets to Cloudflare:

```bash
# Deploy with current OpenAI setup
npm run deploy

# Add optional providers (after getting their API keys)
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ANTHROPIC_GATEWAY_URL
wrangler secret put GOOGLE_API_KEY
wrangler secret put GOOGLE_GATEWAY_URL
```

## Benefits

✅ **Rich Analytics**: See how different models perform  
✅ **Cost Optimization**: Compare costs across providers  
✅ **Performance Insights**: Identify fastest models  
✅ **Automatic Fallback**: If one provider fails, others still work  
✅ **Zero Configuration**: Works automatically once API keys are set

---

Start chatting to see the models rotate! Each conversation will use different models, and within hours you'll have comprehensive analytics data. 🚀
