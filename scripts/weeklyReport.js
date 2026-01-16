const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { DateTime } = require('luxon');
const { summarizeAnalytics } = require('../shared/analyticsStore');

const REPORT_RECIPIENT = process.env.REPORT_RECIPIENT || 'suresh2692@gmail.com';
const REPORT_SENDER = process.env.REPORT_SENDER || 'analytics@portfolio.local';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true' || Number(process.env.EMAIL_PORT) === 465,
    auth: {
        user: process.env.EMAIL_USER || 'your-user@example.com',
        pass: process.env.EMAIL_PASS || 'change-me'
    }
});

const formatDuration = (seconds = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
};

const buildHtmlReport = (summary) => {
    const sectionRows = Object.entries(summary.sections || {})
        .sort((a, b) => (b[1].time || 0) - (a[1].time || 0))
        .slice(0, 5)
        .map(([key, value]) => `<li><strong>${key}</strong>: ${formatDuration(value.time || 0)} across ${value.enters || 0} visits</li>`) || [];

    const clickRows = Object.entries(summary.clickTargets || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key, value]) => `<li>${key} — ${value} clicks</li>`);

    return `
        <h2>Weekly Analytics Snapshot</h2>
        <p>Generated: ${DateTime.now().setZone('Asia/Kolkata').toFormat('DDD t')}</p>
        <ul>
            <li>Total Sessions: <strong>${summary.sessions}</strong></li>
            <li>Average Time on Screen: <strong>${formatDuration(summary.avgTimeOnScreen)}</strong></li>
            <li>Average Scroll Depth: <strong>${summary.avgScrollDepth}%</strong></li>
            <li>Total Clicks: <strong>${summary.totalClicks}</strong></li>
        </ul>
        <h3>Top Sections</h3>
        <ul>${sectionRows.join('') || '<li>No section data yet</li>'}</ul>
        <h3>Top Interactions</h3>
        <ul>${clickRows.join('') || '<li>No click data yet</li>'}</ul>
    `;
};

const sendReport = async () => {
    const summary = summarizeAnalytics();
    if (!summary.sessions) {
        console.log('[analytics] Skipping email send – no sessions recorded yet.');
        return;
    }

    const subject = `Weekly Portfolio Insights · ${DateTime.now().setZone('Asia/Kolkata').toFormat('DDD')}`;
    const html = buildHtmlReport(summary);

    await transporter.sendMail({
        from: REPORT_SENDER,
        to: REPORT_RECIPIENT,
        subject,
        html
    });

    console.log(`[analytics] Weekly report sent to ${REPORT_RECIPIENT}`);
};

const scheduleWeekly = () => {
    cron.schedule('0 9 * * 0', () => {
        sendReport().catch((error) => {
            console.error('[analytics] Failed to send weekly report', error);
        });
    }, {
        timezone: 'Asia/Kolkata'
    });
    console.log('[analytics] Weekly report scheduled for Sundays at 9:00 AM IST');
};

if (require.main === module) {
    const runNow = process.argv.includes('--now');
    if (runNow) {
        sendReport().catch((error) => {
            console.error('[analytics] Immediate report failed', error);
        });
    }
    scheduleWeekly();
}

module.exports = { sendReport, scheduleWeekly };
