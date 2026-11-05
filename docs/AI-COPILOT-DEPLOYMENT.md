# Amiro Intelligence - Production Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] `AI_COPILOT_ENABLED=true` is set
- [ ] AI provider is configured (OpenAI or Ollama)
- [ ] A private local Whisper service is configured through `WHISPER_BASE_URL` (browser recognition is only the fallback)
- [ ] A private local Piper service is configured through `PIPER_BASE_URL` for reply playback
- [ ] Supabase service role key is configured
- [ ] Cost tracking rates are set correctly
- [ ] Budget limits are appropriate for usage

### 2. Database Migrations

- [ ] Migration 022 (profile roles & security) is applied
- [ ] Migration 023 (AI copilot storage) is applied
- [ ] RLS policies are verified and tested
- [ ] Budget reservation RPCs are working
- [ ] `copilot_security_ready()` returns `true`

### 3. Security Verification

- [ ] User authentication is enforced
- [ ] RLS policies block unauthorized access
- [ ] API keys are not exposed to client
- [ ] Rate limiting is configured (default: 20/hour)
- [ ] Daily budget limits are enforced
- [ ] Audit logging is enabled

### 4. Feature Testing

#### Text Queries
- [ ] Basic queries work (today's sales, clients, invoices)
- [ ] Multi-language responses work
- [ ] Conversation history persists
- [ ] Error messages are user-friendly
- [ ] Intent detection accuracy is acceptable

#### Voice Input
- [ ] Microphone access permissions work
- [ ] Audio recording functions properly
- [ ] Whisper transcription is accurate
- [ ] Multi-language voice input works
- [ ] Error handling for failed recordings

#### Read Replies Aloud
- [ ] Local Piper service is running and its voice models are available
- [ ] English, Telugu, Hindi, and Malayalam replies play using their configured Piper voices
- [ ] Other languages use an exact browser voice or show a clear unsupported-language message

#### Analytics Queries
- [ ] Today's sales query returns correct data
- [ ] Weekly/monthly trends calculate correctly
- [ ] Top clients ranking is accurate
- [ ] Outstanding receivables match records
- [ ] Expense analysis is correct
- [ ] Revenue breakdowns are accurate

### 5. Performance Testing

- [ ] Average query response time < 3 seconds
- [ ] Whisper transcription time < 5 seconds
- [ ] Database queries are optimized (< 500ms)
- [ ] No memory leaks in long sessions
- [ ] Handles concurrent users properly

### 6. UI/UX Verification

- [ ] Mobile responsive design works
- [ ] Voice button is clearly visible
- [ ] Language selector is intuitive
- [ ] Loading states are clear
- [ ] Error messages are helpful
- [ ] Conversation history is accessible
- [ ] Record links navigate correctly

---

## 🚀 Deployment Steps

### Step 1: Update Environment Variables

**Production `.env`:**

```bash
# AI Copilot
AI_COPILOT_ENABLED=true

# OpenAI Configuration (Recommended for production)
AI_API_KEY=sk-proj-xxx-your-production-key
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1

# Cost Tracking (GPT-4o-mini rates)
AI_INPUT_COST_PER_MILLION_USD=0.15
AI_OUTPUT_COST_PER_MILLION_USD=0.60

# Budget Controls (adjust based on expected usage)
AI_DAILY_BUDGET_USD=5.00
AI_MAX_REQUESTS_PER_HOUR=50
AI_MAX_REQUEST_COST_USD=0.50

# Local multilingual speech-to-text service (self-host beside the app)
WHISPER_BASE_URL=http://127.0.0.1:8001/v1

# Local Piper TTS service (self-host beside the app)
PIPER_BASE_URL=http://127.0.0.1:8002

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 2: Database Setup

```bash
# Apply migrations
cd backend
npm run migrate

# Verify migrations
psql -d "your-database-url" -c "SELECT * FROM copilot_conversations LIMIT 1;"
```

### Step 3: Build Application

```bash
cd frontend
npm install
npm run typecheck  # Ensure no TypeScript errors
npm run lint       # Ensure code quality
npm run build      # Create production build
```

### Step 4: Deploy

#### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod

# Set environment variables in Vercel dashboard
```

#### Docker Deployment

```bash
# Build Docker image
docker build -t amiro-intelligence:latest .

# Run container
docker run -p 3000:3000 \
  --env-file .env.production \
  amiro-intelligence:latest
```

### Step 5: Post-Deployment Verification

1. **Test Authentication**
   ```bash
   # Visit https://your-domain.com/copilot
   # Ensure login is required
   ```

2. **Test Voice Input**
   - Click microphone button
   - Record a test question
   - Verify transcription works

3. **Test Analytics**
   - Ask "What is today's sales?"
   - Verify accurate data returns
   - Check record links work

4. **Monitor Logs**
   ```bash
   # Check application logs
   vercel logs
   
   # Check OpenAI usage
   https://platform.openai.com/usage
   ```

---

## 📊 Monitoring Setup

### 1. Database Monitoring

Create a monitoring query:

```sql
-- Check AI usage statistics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  SUM(input_tokens + output_tokens) as total_tokens,
  SUM(estimated_cost_usd) as total_cost,
  AVG(input_tokens + output_tokens) as avg_tokens_per_request
FROM ai_usage_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Check error rates
SELECT 
  operation,
  COUNT(*) as request_count,
  COUNT(*) FILTER (WHERE estimated_cost_usd = 0) as error_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE estimated_cost_usd = 0) / COUNT(*), 2) as error_rate_pct
FROM ai_usage_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY operation
ORDER BY request_count DESC;

-- Check top users
SELECT 
  u.email,
  COUNT(*) as request_count,
  SUM(ae.estimated_cost_usd) as total_cost
FROM ai_usage_events ae
JOIN auth.users u ON ae.user_id = u.id
WHERE ae.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.email
ORDER BY request_count DESC
LIMIT 10;
```

### 2. Application Monitoring

Set up alerts for:

- **High Error Rate** - > 5% of requests failing
- **Budget Exceeded** - Daily spending > threshold
- **Slow Responses** - > 5 seconds average
- **Failed Transcriptions** - Local Whisper service errors

### 3. Cost Monitoring

Track OpenAI spending:

```bash
# Daily cost check
curl https://platform.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## 🔧 Troubleshooting Production Issues

### Issue: High API Costs

**Symptoms:** OpenAI bills higher than expected

**Solutions:**
1. Reduce `AI_DAILY_BUDGET_USD`
2. Lower `AI_MAX_REQUESTS_PER_HOUR`
3. Use cheaper model (gpt-4o-mini instead of gpt-4)
4. Implement query caching

### Issue: Slow Responses

**Symptoms:** Queries take > 5 seconds

**Solutions:**
1. Check database query performance
2. Add database indexes if needed
3. Use faster AI model
4. Implement response caching
5. Check network latency

### Issue: Voice Input Fails

**Symptoms:** Whisper transcription errors

**Solutions:**
1. Verify the private Whisper service is running and the model finished loading.
2. Verify `WHISPER_BASE_URL` points to its `/v1` endpoint.
3. Verify HTTPS is enabled for browser microphone access.
4. Check audio format compatibility and the 25 MB upload limit.

### Issue: High Error Rate

**Symptoms:** Many queries fail

**Solutions:**
1. Check AI provider availability
2. Verify database connectivity
3. Review RLS policies
4. Check API rate limits
5. Monitor server resources

---

## 🎯 Performance Optimization

### 1. Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_payments_date_status 
ON payments(payment_date, reversed_at) 
WHERE reversed_at IS NULL;

CREATE INDEX CONCURRENTLY idx_invoices_status_due 
ON invoices(status, due_date) 
WHERE status IN ('issued', 'sent', 'overdue', 'partially_paid');
```

### 2. Response Caching

Implement Redis caching for common queries:

```typescript
// Example cache implementation
const CACHE_TTL = 5 * 60; // 5 minutes

async function getCachedFacts(cacheKey: string, fetchFn: () => Promise<any>) {
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const fresh = await fetchFn();
  await redis.set(cacheKey, JSON.stringify(fresh), 'EX', CACHE_TTL);
  return fresh;
}
```

### 3. AI Model Optimization

- **Use streaming** for faster perceived response time
- **Reduce token limits** for faster generation
- **Use function calling** for structured outputs
- **Implement prompt caching** (if supported)

---

## 🔐 Security Hardening

### 1. API Key Rotation

```bash
# Rotate OpenAI API key quarterly
# 1. Generate new key in OpenAI dashboard
# 2. Update environment variable
# 3. Restart application
# 4. Revoke old key after 24 hours
```

### 2. Rate Limiting

Implement additional rate limiting:

```typescript
// Add to middleware
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/copilot', limiter);
```

### 3. Input Sanitization

Already implemented:
- ✅ Message length limits (2000 chars)
- ✅ Audio file size limits (25MB)
- ✅ SQL injection protection (parameterized queries)
- ✅ XSS protection (React auto-escaping)

---

## 📈 Success Metrics

Track these KPIs:

| Metric | Target | Current |
|--------|--------|---------|
| Query Success Rate | > 95% | - |
| Average Response Time | < 3s | - |
| Voice Transcription Accuracy | > 90% | - |
| Daily Active Users | - | - |
| Cost per Query | < $0.01 | - |
| User Satisfaction | > 4.5/5 | - |

---

## 🎉 Go-Live Checklist

### Day Before Launch

- [ ] All tests passing
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Production build successful
- [ ] Monitoring configured
- [ ] Backup procedures verified
- [ ] Rollback plan documented

### Launch Day

- [ ] Deploy to production
- [ ] Verify authentication works
- [ ] Test voice input (HTTPS required)
- [ ] Test analytics queries
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify cost tracking

### Day After Launch

- [ ] Review usage statistics
- [ ] Check OpenAI spending
- [ ] Analyze error logs
- [ ] Gather user feedback
- [ ] Optimize based on actual usage
- [ ] Document issues and resolutions

---

## 📞 Support Contacts

- **OpenAI API Issues:** https://platform.openai.com/docs
- **Supabase Support:** https://supabase.com/support
- **Application Issues:** Check GitHub issues or internal support

---

**Production deployment complete! Monitor, optimize, and iterate based on real usage. 🚀**
