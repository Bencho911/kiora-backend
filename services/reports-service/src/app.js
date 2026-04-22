const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Health Check
app.get('/api/reports/health', (req, res) => res.status(200).json({ status: 'OK' }));

app.use('/api/reports', reportRoutes);

module.exports = app;
