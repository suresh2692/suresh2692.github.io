const express = require('express');
const cors = require('cors');
const { appendSession, summarizeAnalytics } = require('../shared/analyticsStore');

const app = express();
const PORT = process.env.ANALYTICS_PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '500kb' }));

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/collect', (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    try {
        appendSession({
            ...payload,
            receivedAt: new Date().toISOString()
        });
        return res.status(201).json({ status: 'stored' });
    } catch (error) {
        console.error('Failed to save analytics event', error);
        return res.status(500).json({ error: 'Failed to store analytics data' });
    }
});

app.get('/metrics', (_req, res) => {
    try {
        const summary = summarizeAnalytics();
        res.json(summary);
    } catch (error) {
        console.error('Failed to build analytics summary', error);
        res.status(500).json({ error: 'Unable to build summary' });
    }
});

const server = app.listen(PORT, () => {
    console.log(`Analytics server listening on port ${PORT}`);
});

module.exports = { app, server };
