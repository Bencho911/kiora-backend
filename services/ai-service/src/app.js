const express = require('express');
const cors = require('cors');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:4321', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ai-service' }));

app.use('/api/ai', aiRoutes);

app.use((err, _req, res, _next) => {
  console.error('[AI Service] Error:', err.message);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => {
  console.log(`AI Service running on port ${PORT}`);
  const { startCronJobs } = require('./jobs/inventoryCron');
  startCronJobs();
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn('[AI Service] WARNING: DEEPSEEK_API_KEY no configurada');
  }
});
