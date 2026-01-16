const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'analytics-store.json');
const SECRET = process.env.ANALYTICS_ENCRYPTION_KEY || 'suresh-portfolio-analytics-secret-key-2026';
const KEY = crypto.createHash('sha256').update(SECRET).digest();
const ALGORITHM = 'aes-256-gcm';

const ensureFile = () => {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, '', 'utf8');
    }
};

const encryptData = (payload) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

const decryptData = (payload) => {
    const buffer = Buffer.from(payload, 'base64');
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted);
};

const readAnalytics = () => {
    ensureFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8').trim();
    if (!raw) return [];
    try {
        return decryptData(raw);
    } catch (error) {
        try {
            return JSON.parse(raw);
        } catch (parseError) {
            console.error('Unable to parse analytics store', parseError);
            return [];
        }
    }
};

const writeAnalytics = (sessions) => {
    ensureFile();
    const payload = encryptData(sessions);
    fs.writeFileSync(DATA_FILE, payload, 'utf8');
};

const sanitizeSession = (session = {}) => ({
    sessionId: session.sessionId || crypto.randomUUID(),
    startTime: session.startTime || Date.now(),
    endTime: session.endTime || Date.now(),
    page: session.page || '/',
    scrollDepth: Number(session.scrollDepth || 0),
    timeOnScreen: Number(session.timeOnScreen || 0),
    clicks: Array.isArray(session.clicks) ? session.clicks.slice(-100) : [],
    sections: typeof session.sections === 'object' && session.sections !== null ? session.sections : {},
    events: Array.isArray(session.events) ? session.events.slice(-200) : [],
    deviceInfo: session.deviceInfo || {}
});

const appendSession = (session) => {
    const sessions = readAnalytics();
    sessions.push(sanitizeSession(session));
    if (sessions.length > 1000) {
        sessions.shift();
    }
    writeAnalytics(sessions);
    return sessions;
};

const summarizeAnalytics = (sessions = readAnalytics()) => {
    if (!sessions.length) {
        return {
            sessions: 0,
            avgTimeOnScreen: 0,
            avgScrollDepth: 0,
            totalClicks: 0,
            screenSizes: {},
            clickTargets: {},
            sections: {},
            timeline: {}
        };
    }

    const acc = {
        totalTime: 0,
        totalScroll: 0,
        totalClicks: 0,
        screenSizes: {},
        clickTargets: {},
        sections: {},
        timeline: {}
    };

    sessions.forEach((session) => {
        acc.totalTime += session.timeOnScreen || 0;
        acc.totalScroll += session.scrollDepth || 0;
        acc.totalClicks += (session.clicks || []).length;

        const size = session.deviceInfo?.screenSize || 'unknown';
        acc.screenSizes[size] = (acc.screenSizes[size] || 0) + 1;

        (session.clicks || []).forEach((click) => {
            const label = `${click.target}${click.text ? ` (${click.text.trim()})` : ''}`;
            acc.clickTargets[label] = (acc.clickTargets[label] || 0) + 1;
        });

        Object.entries(session.sections || {}).forEach(([key, value]) => {
            const store = acc.sections[key] || { time: 0, enters: 0 };
            store.time += value.time || 0;
            store.enters += value.enters || 0;
            acc.sections[key] = store;
        });

        const hourKey = new Date(session.endTime || session.startTime).toISOString().slice(0, 13);
        acc.timeline[hourKey] = (acc.timeline[hourKey] || 0) + 1;
    });

    return {
        sessions: sessions.length,
        avgTimeOnScreen: Math.round(acc.totalTime / sessions.length),
        avgScrollDepth: Math.round(acc.totalScroll / sessions.length),
        totalClicks: acc.totalClicks,
        screenSizes: acc.screenSizes,
        clickTargets: acc.clickTargets,
        sections: acc.sections,
        timeline: acc.timeline
    };
};

module.exports = {
    DATA_FILE,
    readAnalytics,
    writeAnalytics,
    appendSession,
    summarizeAnalytics
};
