const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const path = require('path');

dotenv.config();

if (process.env.GROQ_API_KEY) {
  console.log("🔑 API Key loaded: YES ✅");
} else {
  console.log("🔑 API Key loaded: NO ❌");
}

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Serve frontend from Express — no Live Server needed
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
const analyzeRoutes = require('./routes/analyze');
app.use('/api/analyze', analyzeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ message: 'ParliDebate AI Backend Running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});