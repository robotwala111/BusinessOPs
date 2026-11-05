# 🚀 Quick Start: Amiro Intelligence (100% FREE!)

## ⚡ 2-Minute Setup (No API Keys Required!)

### Step 1: Verify Ollama is Running (30 seconds)

```bash
# Check if Ollama is running
ollama list

# If not installed, download from: https://ollama.com
# Then start it:
ollama serve

# Pull the model (one-time):
ollama pull qwen3.5:2b
```

### Step 2: Verify Environment (30 seconds)

Your `frontend/.env` should already have (FREE setup):

```bash
AI_COPILOT_ENABLED=true
AI_API_KEY=ollama
AI_MODEL=qwen3.5:2b
AI_BASE_URL=http://localhost:11434/v1
AI_INPUT_COST_PER_MILLION_USD=0
AI_OUTPUT_COST_PER_MILLION_USD=0
```

### Step 3: Start Application (1 minute)

```bash
cd frontend
npm run dev
```

Visit: **http://localhost:3000/copilot**

**Zero configuration! No API keys needed!** 🎉

---

## 🎤 Test Voice Input (FREE - Instant!)

1. Click the **🎤 microphone button**
2. Allow microphone access (browser will ask once)
3. Say clearly: **"What is today's sales?"**
4. **Instant transcription** (no waiting!)
5. Review text, then click **"Ask Assistant"**

**Works in Chrome, Edge, Safari - completely free!** ✨

---

## 📊 Try These Queries

### Type or Say:

**Sales Analytics:**
- "What is today's sales?"
- "Show weekly sales trend"
- "Top clients by revenue"

**Financial:**
- "Outstanding receivables"
- "Expense analysis"
- "Payment collection status"

**Operations:**
- "Pending quotations"
- "Delayed projects"
- "Overdue invoices"

### Multi-Language:

**Hindi:** "आज की बिक्री क्या है?"  
**Telugu:** "ఈరోజు అమ్మకాలు ఎంత?"  
**Tamil:** "இன்றைய விற்பனை என்ன?"

---

## 🌐 Change Response Language

1. Click **language dropdown** (top of chat)
2. Select your preferred language
3. Ask any question
4. Get response in selected language!

---

## ✅ Verification Checklist

- [ ] Ollama is running (`ollama list` shows models)
- [ ] Application starts without errors
- [ ] Can navigate to `/copilot` page
- [ ] Microphone button appears (🎤)
- [ ] Voice input works (instant transcription!)
- [ ] Text queries work
- [ ] Language selector changes responses
- [ ] Conversation history saves

---

## 🐛 Quick Troubleshooting

### "AI provider could not complete request"
➡️ **Solution:** Start Ollama
```bash
ollama serve
```

### Microphone button missing
➡️ **Solution:** Use Chrome, Edge, or Safari browser  
(Web Speech API requires modern browser)

### Voice transcription not working
➡️ **Solution:** Allow microphone in browser settings  
(Chrome: Settings → Privacy → Site Settings → Microphone)

### Queries return errors
➡️ **Solution:** Verify database migrations
```bash
cd backend
npm run migrate
```

### Slow responses from Ollama
➡️ **Solution:** Use smaller model or upgrade hardware  
Try: `ollama pull qwen2.5:1.5b` (faster, smaller)

---

## 💰 Cost Breakdown

**Your Current Setup (100% FREE):**

| Component | Service | Monthly Cost |
|-----------|---------|--------------|
| **Speech-to-Text** | Web Speech API (browser) | **$0** ✅ |
| **AI Responses** | Ollama (local) | **$0** ✅ |
| **Database** | Supabase Free Tier | **$0** ✅ |
| **Total** | | **$0/month** 🎉 |

**Optional Upgrades (if needed later):**

| Upgrade | Monthly Cost | Benefit |
|---------|--------------|---------|
| OpenAI GPT-4o-mini | ~$5 | More natural AI responses |
| OpenAI Whisper API | ~$9 | Better voice accuracy (50+ languages) |
| **Total (upgraded)** | **~$15/month** | Maximum quality |

**Start free, upgrade only if needed!** 🎯

---

## 🎬 What Works FREE

✅ **Voice Input** - Instant transcription in 11+ languages  
✅ **AI Responses** - Business analytics & insights  
✅ **Multi-Language** - Hindi, Telugu, Tamil, Malayalam, etc.  
✅ **Sales Analytics** - Real-time calculations  
✅ **Financial Intelligence** - Outstanding receivables, expenses  
✅ **Operations** - Projects, quotations, invoices  
✅ **Conversation History** - All queries saved  
✅ **Record Links** - Click results for details  

**Everything you saw in the demo - all FREE!** 🚀

---

## 📚 Full Documentation

- **User Guide:** `docs/AI-COPILOT-GUIDE.md`
- **Free vs Paid:** See comparison artifact
- **Deployment:** `docs/AI-COPILOT-DEPLOYMENT.md`
- **Demo Script:** `docs/AI-COPILOT-DEMO-SCRIPT.md`

---

## 🎊 You're Ready!

**No API keys needed. No monthly costs. Production-ready!**

Start asking: **"What is today's sales?"**

Or try voice: Click 🎤 and speak naturally!

Enjoy your 100% FREE AI business intelligence! 🎉
