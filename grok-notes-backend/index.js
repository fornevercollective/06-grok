require('dotenv').config();
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AWS = require('aws-sdk');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const cheerio = require('cheerio');
const { YoutubeTranscript } = require('youtube-transcript');

const app = express();
const PORT = process.env.PORT || 3000;

// Ollama settings
const OLLAMA_HOST = 'http://localhost:11434';
let ollamaProcess = null;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// In-memory storage (replace with DB in production)
let notebooks = [];
let users = [];

// Encryption helpers
const algorithm = 'aes-256-cbc';
const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
const iv = crypto.randomBytes(16);

function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encryptedData: encrypted, iv: iv.toString('hex') };
}

function decrypt(encryptedData, ivHex) {
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Ollama management
async function ensureOllamaRunning() {
  if (ollamaProcess) return;
  try {
    await axios.get(`${OLLAMA_HOST}/api/tags`);
  } catch (error) {
    console.log('Starting Ollama...');
    ollamaProcess = spawn('ollama', ['serve'], { stdio: 'inherit' });
    // Wait a bit for it to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function pullModel(model) {
  try {
    const response = await axios.post(`${OLLAMA_HOST}/api/pull`, { name: model });
    console.log(`Pulled model: ${model}`);
  } catch (error) {
    console.error(`Failed to pull model ${model}:`, error.message);
  }
}

async function checkInternet() {
  try {
    await axios.get('https://www.google.com', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Passport strategies
if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  }, (accessToken, refreshToken, profile, done) => {
  // Find or create user
  let user = users.find(u => u.id === profile.id);
  if (!user) {
    user = { id: profile.id, name: profile.displayName, provider: 'google' };
    users.push(user);
  }
  return done(null, user);
  }));
}

if (process.env.GITHUB_CLIENT_ID) {
  passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: '/auth/github/callback'
}, (accessToken, refreshToken, profile, done) => {
  let user = users.find(u => u.id === profile.id);
  if (!user) {
    user = { id: profile.id, name: profile.displayName, provider: 'github' };
    users.push(user);
  }
  return done(null, user);
  }));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user);
});

// Auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET || 'secret');
  res.redirect(`http://localhost:5173?token=${token}`);
});

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => {
  const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET || 'secret');
  res.redirect(`http://localhost:5173?token=${token}`);
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Notebook routes
app.get('/api/notebooks', authenticateToken, (req, res) => {
  res.json(notebooks.filter(n => n.userId === req.user.userId));
});

app.post('/api/notebooks', authenticateToken, (req, res) => {
  const { title, content } = req.body;
  const encrypted = encrypt(JSON.stringify(content));
  const notebook = { id: Date.now().toString(), userId: req.user.userId, title, content: encrypted };
  notebooks.push(notebook);
  res.status(201).json(notebook);
});

app.get('/api/notebooks/:id', authenticateToken, (req, res) => {
  const notebook = notebooks.find(n => n.id === req.params.id && n.userId === req.user.userId);
  if (!notebook) return res.sendStatus(404);
  const decrypted = JSON.parse(decrypt(notebook.content.encryptedData, notebook.content.iv));
  res.json({ ...notebook, content: decrypted });
});

app.put('/api/notebooks/:id', authenticateToken, (req, res) => {
  const notebook = notebooks.find(n => n.id === req.params.id && n.userId === req.user.userId);
  if (!notebook) return res.sendStatus(404);
  const { title, content } = req.body;
  const encrypted = encrypt(JSON.stringify(content));
  notebook.title = title;
  notebook.content = encrypted;
  res.json(notebook);
});

app.delete('/api/notebooks/:id', authenticateToken, (req, res) => {
  const index = notebooks.findIndex(n => n.id === req.params.id && n.userId === req.user.userId);
  if (index === -1) return res.sendStatus(404);
  notebooks.splice(index, 1);
  res.sendStatus(204);
});

// AI Integration
app.post('/api/ai/chat', async (req, res) => {
  const { message, offline = false, model = 'llama3.2' } = req.body;
  const isOnline = await checkInternet();
  const useOffline = offline || !isOnline;

  if (useOffline) {
    try {
      await ensureOllamaRunning();
      await pullModel(model); // Ensure model is available
      const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
        model: model,
        prompt: message,
        stream: false
      });
      res.json({ response: response.data.response, mode: 'offline' });
    } catch (error) {
      res.status(500).json({ error: 'Offline AI request failed', details: error.message });
    }
  } else {
    try {
      const response = await axios.post('https://api.x.ai/v1/chat/completions', {
        messages: [{ role: 'user', content: message }],
        model: 'grok-1'
      }, {
        headers: { 'Authorization': `Bearer ${process.env.GROK_API_KEY}` }
      });
      res.json({ response: response.data.choices[0].message.content, mode: 'online' });
    } catch (error) {
      res.status(500).json({ error: 'Online AI request failed' });
    }
  }
});

// Multimodal AI (images)
app.post('/api/ai/chat-multimodal', async (req, res) => {
  const { message, image, offline = false, model = 'llava' } = req.body;
  const isOnline = await checkInternet();
  const useOffline = offline || !isOnline;

  if (useOffline) {
    try {
      await ensureOllamaRunning();
      await pullModel(model);
      const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
        model: model,
        prompt: message,
        images: image ? [image] : [], // base64 encoded image
        stream: false
      });
      res.json({ response: response.data.response, mode: 'offline' });
    } catch (error) {
      res.status(500).json({ error: 'Offline multimodal AI request failed', details: error.message });
    }
  } else {
    // Fallback to Hugging Face or something, but for now, return not supported
    res.status(501).json({ error: 'Online multimodal not implemented yet' });
  }
});

// Offline Training
app.post('/api/ai/train', async (req, res) => {
  const { modelName, baseModel, modelfile } = req.body;
  try {
    await ensureOllamaRunning();
    // Create a temporary Modelfile
    const modelfilePath = path.join(__dirname, `${modelName}.modelfile`);
    fs.writeFileSync(modelfilePath, modelfile);

    const createProcess = spawn('ollama', ['create', modelName, '-f', modelfilePath]);
    createProcess.on('close', (code) => {
      fs.unlinkSync(modelfilePath);
      if (code === 0) {
        res.json({ message: `Model ${modelName} created successfully` });
      } else {
        res.status(500).json({ error: 'Training failed' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Training request failed', details: error.message });
  }
});

// Cloud ML (AWS SageMaker)
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const sagemaker = new AWS.SageMaker();

app.post('/api/ml/train', (req, res) => {
  // Simplified training job creation
  const params = {
    TrainingJobName: `grok-notes-${Date.now()}`,
    AlgorithmSpecification: {
      TrainingImage: '763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-training:2.11.0-cpu-py39-ubuntu20.04-sagemaker',
      TrainingInputMode: 'File'
    },
    RoleArn: process.env.SAGEMAKER_ROLE_ARN,
    InputDataConfig: req.body.inputDataConfig,
    OutputDataConfig: { S3OutputPath: req.body.outputPath },
    ResourceConfig: req.body.resourceConfig,
    StoppingCondition: { MaxRuntimeInSeconds: 3600 }
  };
  sagemaker.createTrainingJob(params, (err, data) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(data);
  });
});

app.post('/api/ml/infer', (req, res) => {
  // Simplified inference
  res.json({ result: 'Inference result placeholder' });
});

// Proxy for grokipedia
app.get('/api/proxy', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const response = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data);
    // Extract left panel (e.g., for Wikipedia, #mw-panel)
    const left = $('#mw-panel').html() || '';
    // Main content (#content)
    const main = $('#content').html() || '';
    // Notes and analysis empty for now
    res.json({ left, main, notes: '', analysis: '' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch page', details: error.message });
  }
});

// YouTube transcript
app.get('/api/youtube-transcript', async (req, res) => {
  const videoId = req.query.v;
  const lang = req.query.lang || 'en';
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
    const text = transcript.map(item => item.text).join(' ');
    res.json({ text, source: 'youtube' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transcript', details: error.message });
  }
});

function decodeYtEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function transcriptFromTimedTextXml(xml) {
  const chunks = [];
  const re = /<text[^>]*>([^<]*)<\/text>/g;
  let m;
  while ((m = re.exec(xml))) {
    chunks.push(decodeYtEntities(m[1]));
  }
  return chunks.join('\n').trim();
}

/** Pull utf8 strings from YouTube timedtext JSON3 (nested shape varies). */
function transcriptFromJson3(obj) {
  const parts = [];
  const walk = (node) => {
    if (node == null) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object') {
      if (typeof node.utf8 === 'string') parts.push(node.utf8);
      Object.values(node).forEach(walk);
    }
  };
  walk(obj);
  return parts.join('');
}

/** Server-side fetch: browser cannot call YouTube timedtext directly (CORS). */
app.get('/api/youtube-transcript', async (req, res) => {
  const v = String(req.query.v || '').trim();
  const lang = String(req.query.lang || 'en').trim() || 'en';
  if (!/^[a-zA-Z0-9_-]{11}$/.test(v)) {
    return res.status(400).json({ error: 'Expected YouTube video id (11 characters)' });
  }
  const ua = {
    'User-Agent':
      'Mozilla/5.0 (compatible; GrokNotes/1.0; +https://github.com/) AppleWebKit/537.36 (KHTML, like Gecko)',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const urls = [
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(v)}&lang=${encodeURIComponent(lang)}&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(v)}&fmt=json3&lang=${encodeURIComponent(lang)}`,
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(v)}&lang=${encodeURIComponent(lang)}`,
  ];
  let lastDetail = '';
  for (const url of urls) {
    try {
      const r = await axios.get(url, {
        timeout: 18000,
        headers: ua,
        validateStatus: (s) => s === 200,
        responseType: 'text',
      });
      const raw = r.data;
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const t = raw.trim();
      if (t.startsWith('{')) {
        try {
          const j = JSON.parse(t);
          const text = transcriptFromJson3(j);
          if (text && text.trim()) {
            return res.json({ text: text.trim(), source: 'youtube-json3' });
          }
        } catch (e) {
          lastDetail = e.message;
        }
      }
      if (t.includes('<text')) {
        const text = transcriptFromTimedTextXml(t);
        if (text) {
          return res.json({ text, source: 'youtube-xml' });
        }
      }
    } catch (e) {
      lastDetail = e.message || String(e);
    }
  }
  return res.status(502).json({
    error:
      'Could not load captions (video may have none, or auto-captions disabled). Try another language or paste manually.',
    detail: lastDetail,
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});