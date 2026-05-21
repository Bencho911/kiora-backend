const express = require('express');
const cors = require('cors');
const activityRoutes = require('./routes/activityLog');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/activity-logs', activityRoutes);

app.use((err, _req, res, _next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {
  console.log(`Activity Service running on port ${PORT}`);
});
