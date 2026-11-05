# Amiro Intelligence - AI Copilot Guide

## 🚀 Overview

**Amiro Intelligence** is a production-ready AI-powered business operations assistant that provides:

- **📊 Real-time Sales Analytics** - Today's sales, weekly trends, revenue analysis
- **💰 Financial Intelligence** - Outstanding receivables, expense analysis, collection rates  
- **🎤 Multi-language Voice Input** - Transcribe speech locally with multilingual faster-whisper
- **🌍 Multi-language Responses** - Get answers in Hindi, Telugu, Tamil, Malayalam, and more
- **📈 Business Insights** - Top clients, delayed projects, pending quotations

---

## 🎯 Features

### Sales & Revenue Analytics

Ask questions like:
- "What is today's sales?"
- "Show me weekly sales trend"
- "Analyze monthly revenue"
- "Show top 10 clients by revenue"

### Financial Intelligence

- **Outstanding Receivables** - Track unpaid invoices and overdue amounts
- **Expense Analysis** - Break down expenses by category
- **Payment Collection Status** - Monitor collection rates
- **Revenue Breakdown** - By payment method, client, time period

### Voice Input (Free Local Whisper)

- **Record your question** using the 🎤 microphone button
- **Multilingual transcription** with automatic language detection across Whisper's supported languages, including:
  - English, Hindi, Telugu, Tamil
  - Malayalam, Kannada, Marathi
  - Bengali, Gujarati, Arabic, Spanish
- **Local transcription** using faster-whisper; no paid API key or audio upload to a cloud provider
- **Works in any browser** with microphone access

### Read Replies Aloud (Free Local Piper)

- The message speaker uses local Piper voices for English, Hindi, Telugu, and Malayalam.
- Tamil, Kannada, and other languages use the browser only when it has an exact matching voice installed; the app never silently substitutes an English voice.
- Install the voices and start the service using [backend/piper/README.md](../backend/piper/README.md), then set `PIPER_BASE_URL=http://127.0.0.1:8002` in `frontend/.env.local`.
- Piper is text-to-speech. Local Whisper remains the separate microphone speech-to-text service.

### Multi-language Support

Select your preferred response language:
- Auto-detect (analyzes your question)
- English, हिंदी, తెలుగు, தமிழ்
- മലയാളം, ಕನ್ನಡ, मराठी
- বাংলা, ગુજરાતી, العربية, Español

---

## 🛠️ Setup Instructions

### 1. Prerequisites

- Node.js 18+ and npm
- Supabase project configured
- Python 3.10+ for the optional local Whisper service

### 2. Environment Configuration

Update `frontend/.env`:

```bash
# AI Copilot
AI_COPILOT_ENABLED=true

# For local Ollama (free)
AI_API_KEY=ollama
AI_MODEL=qwen3.5:2b
AI_BASE_URL=http://localhost:11434/v1
AI_INPUT_COST_PER_MILLION_USD=0
AI_OUTPUT_COST_PER_MILLION_USD=0

# Free local multilingual speech-to-text (run backend/whisper first)
WHISPER_BASE_URL=http://127.0.0.1:8001/v1

# Free local Piper speech output (run backend/piper first)
PIPER_BASE_URL=http://127.0.0.1:8002

# For OpenAI GPT (paid, more accurate)
# AI_API_KEY=sk-your-api-key
# AI_MODEL=gpt-4o-mini
# AI_BASE_URL=https://api.openai.com/v1
# AI_INPUT_COST_PER_MILLION_USD=0.15
# AI_OUTPUT_COST_PER_MILLION_USD=0.60

# Budget Controls
AI_DAILY_BUDGET_USD=2
AI_MAX_REQUESTS_PER_HOUR=20
AI_MAX_REQUEST_COST_USD=0.25

```

Start the local Whisper service using [backend/whisper/README.md](../backend/whisper/README.md) for microphone transcription. Start Piper using [backend/piper/README.md](../backend/piper/README.md) for reading replies aloud. Both run locally after their one-time model downloads.

### 3. Start Local Whisper

Follow the setup in [backend/whisper/README.md](../backend/whisper/README.md), then set `WHISPER_BASE_URL=http://127.0.0.1:8001/v1` in `frontend/.env.local` and restart Next.js. The multilingual model is downloaded once and runs on your machine; no transcription API key is needed.

### 4. Start Local Piper TTS

Follow [backend/piper/README.md](../backend/piper/README.md) to install Piper and download voice files, then start the service on port 8002. Set `PIPER_BASE_URL=http://127.0.0.1:8002` and restart Next.js. It reads replies aloud and does not replace Whisper transcription.

### 4. Apply Database Migrations

```bash
cd backend
# Ensure migrations 022 and 023 are applied
npm run migrate
```

### 5. Start the Application

```bash
cd frontend
npm install
npm run dev
```

Navigate to: `http://localhost:3000/copilot`

---

## 📊 Available Queries

### Sales Analytics

| Query | Description |
|-------|-------------|
| "What is today's sales?" | Today's payment collections |
| "Show weekly sales" | Last 7 days sales with daily breakdown |
| "Monthly sales trend" | Current month daily sales pattern |
| "Revenue analysis" | Revenue breakdown by payment method |

### Client Insights

| Query | Description |
|-------|-------------|
| "Top clients by revenue" | Top 10 clients ranked by total revenue |
| "Show all clients" | Active client portfolio |
| "Client follow-ups" | Clients needing attention |

### Financial Management

| Query | Description |
|-------|-------------|
| "Outstanding receivables" | Unpaid invoices with amounts |
| "Payment collection status" | Collection rate and breakdown |
| "Expense analysis" | Monthly expenses by category |
| "Monthly financials" | Revenue vs expenses summary |

### Operations

| Query | Description |
|-------|-------------|
| "Overdue invoices" | Late payments requiring action |
| "Pending quotations" | Quotes awaiting approval |
| "Delayed projects" | Projects behind schedule |
| "Expiring contracts" | Contracts needing renewal |

---

## 🎤 Voice Input Guide

### How to Use Voice Input

1. **Click the 🎤 microphone button**
2. **Allow microphone access** (browser permission)
3. **Speak your question** clearly
4. **Click ⏹️ to stop recording**
5. **Wait for transcription** (2-5 seconds)
6. **Review and send** the transcribed text

### Voice Input Tips

✅ **Do:**
- Speak clearly and at normal pace
- Use natural language
- Wait for quiet environment
- Review transcription before sending

❌ **Avoid:**
- Speaking too fast or mumbling
- Background noise (fans, music)
- Extremely long questions (keep under 1 minute)
- Multiple people speaking

### Supported Languages

Voice input works in these languages:
- **English** - "What is today's sales?"
- **Hindi** - "आज की बिक्री क्या है?"
- **Telugu** - "ఈరోజు అమ్మకాలు ఎంత?"
- **Tamil** - "இன்றைய விற்பனை என்ன?"
- **Malayalam** - "ഇന്നത്തെ വിൽപ്പന എന്താണ്?"
- **And 6+ more languages**

---

## 🧪 Testing Checklist

### Text Queries
- [ ] "What is today's sales?" returns revenue
- [ ] "Top clients by revenue" shows ranked list
- [ ] "Outstanding receivables" shows unpaid invoices
- [ ] "Monthly sales trend" shows daily breakdown
- [ ] Hindi query: "आज की बिक्री क्या है?"
- [ ] Telugu query: "ఈరోజు అమ్మకాలు ఎంత?"

### Voice Input
- [ ] Microphone permission works
- [ ] Can record audio
- [ ] Transcription completes successfully
- [ ] Transcription accuracy is acceptable
- [ ] Works in multiple languages
- [ ] Error handling for failed recordings

### Multi-language Responses
- [ ] Auto-detect responds in query language
- [ ] Hindi response setting works
- [ ] Telugu response setting works
- [ ] Language persists in conversation

---

## 🐛 Troubleshooting

### "Local Whisper is not configured"

**Problem:** Speech-to-text cannot reach the local transcription engine.

**Solution:**
1. Start the service in `backend/whisper` using its README instructions.
2. Set `WHISPER_BASE_URL=http://127.0.0.1:8001/v1` in `frontend/.env.local`.
3. Restart the Next.js development server.

### "Speech recognition service error"

**Problem:** Local Whisper cannot decode or transcribe the audio.

**Solution:**
1. Confirm the local Whisper service is running and its model finished loading.
2. Check that the microphone recording is not empty and is under 25 MB.
3. Try a shorter clip in a quiet environment.

### "Microphone access denied"

**Problem:** Browser blocks microphone

**Solution:**
1. Allow microphone in browser settings
2. Use HTTPS (required for production)
3. Check browser compatibility (Chrome, Edge, Firefox)

### "AI provider could not complete request"

**Problem:** AI model fails to respond

**Solution:**
1. For Ollama: Ensure Ollama is running (`ollama serve`)
2. For OpenAI: Check API key and credits
3. Verify `AI_BASE_URL` is correct
4. Check network connectivity

### Voice input not showing

**Problem:** Microphone button doesn't appear

**Solution:**
1. Use HTTPS (required in production)
2. Check browser compatibility
3. Verify microphone device exists
4. Clear browser cache and reload

---

## 💡 Best Practices

### For Admins

1. **Set Budget Limits** - Configure `AI_DAILY_BUDGET_USD` appropriately
2. **Monitor Usage** - Check `ai_usage_events` table regularly
3. **Test Before Production** - Validate all queries with real data
4. **Configure Rate Limits** - Adjust `AI_MAX_REQUESTS_PER_HOUR`

### For Users

1. **Use Voice for Complex Queries** - Faster than typing
2. **Select Language First** - For consistent responses
3. **Review Suggestions** - Use pre-made queries as templates
4. **Check Record Links** - Click on results for details

---

## 📈 Performance Optimization

### Local Whisper

- **Cost:** No per-minute transcription fee; it uses local CPU/GPU resources.
- **First startup:** Downloads model weights once.
- **Recommended:** Keep recordings concise for quicker local transcription.

### AI Model

- **Ollama (local):** Free, slower, good for basic queries
- **OpenAI GPT-4o-mini:** $0.15/M input, $0.60/M output, fast, accurate
- **Recommended for production:** GPT-4o-mini

### Database Queries

- All queries are **read-only** and **indexed**
- **Typical response time:** < 500ms
- **Pagination:** Automatically limits results

---

## 🔐 Security Notes

1. **API Keys** - Never commit `.env` files to Git
2. **Budget Controls** - Enforced at database level (RLS + stored procedures)
3. **User Isolation** - Each user sees only their authorized data
4. **Rate Limiting** - Prevents abuse (20 requests/hour default)
5. **Audit Trail** - All queries logged in `ai_usage_events`

---

## 🎨 UI Customization

### Branding

Update in `copilot/page.tsx`:

```typescript
const INITIAL_GREETING_MESSAGE: CopilotMessage = {
  // ... customize greeting message
  content: "Welcome to **Your Company Intelligence**...",
};
```

### Suggestions

Update suggestion prompts:

```typescript
const suggestions = [
  "Your custom query 1",
  "Your custom query 2",
  // ...
];
```

### Styling

Copilot uses global CSS classes:
- `.copilot-page` - Main container
- `.copilot-header` - Header section
- `.copilot-layout` - Two-column layout
- `.copilot-chat` - Chat interface
- `.copilot-message` - Message bubbles

---

## 📞 Support

For issues or questions:

1. Check the [troubleshooting section](#-troubleshooting)
2. Review logs in browser console and server terminal
3. Check `ai_usage_events` table for error details
4. Verify environment configuration

---

## 🎉 Success Metrics

Track these metrics for business value:

- **Query success rate** - Target: > 95%
- **Average response time** - Target: < 3 seconds
- **User adoption** - Track unique users per day
- **Most common queries** - Optimize for these
- **Voice vs text ratio** - Measure feature adoption

---

**Enjoy using Amiro Intelligence! 🚀**
