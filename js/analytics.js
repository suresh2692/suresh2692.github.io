/* global CryptoJS */

const AnalyticsConfig = {
    ENCRYPTION_KEY: 'suresh-portfolio-analytics-secret-key-2026',
    STORAGE_KEY: 'analytics_data_v2',
    SESSION_TIMEOUT: 30 * 60 * 1000,
    SYNC_INTERVAL: 15 * 1000,
    API_BASE: window.ANALYTICS_ENDPOINT || '',
};

const cryptoOrFallback = () => {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }
    return 'sess-' + Math.random().toString(36).substring(2, 11);
};

const baseSession = () => ({
    sessionId: cryptoOrFallback(),
    startTime: Date.now(),
    endTime: null,
    page: window.location.pathname,
    clicks: [],
    scrollDepth: 0,
    timeOnScreen: 0,
    sections: {},
    events: [],
    deviceInfo: {
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
        platform: navigator.platform
    }
});

const SecureStorage = {
    encrypt(data) {
        if (typeof CryptoJS === 'undefined') {
            return JSON.stringify(data);
        }
        try {
            return CryptoJS.AES.encrypt(JSON.stringify(data), AnalyticsConfig.ENCRYPTION_KEY).toString();
        } catch (error) {
            console.error('Encryption failed', error);
            return JSON.stringify(data);
        }
    },
    decrypt(cipherText) {
        if (typeof CryptoJS === 'undefined') {
            return JSON.parse(cipherText);
        }
        try {
            const bytes = CryptoJS.AES.decrypt(cipherText, AnalyticsConfig.ENCRYPTION_KEY);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (error) {
            console.error('Decryption failed', error);
            return [];
        }
    },
    save(data) {
        try {
            const encrypted = SecureStorage.encrypt(data);
            localStorage.setItem(AnalyticsConfig.STORAGE_KEY, encrypted);
        } catch (error) {
            console.error('Unable to save analytics snapshot', error);
        }
    },
    load() {
        try {
            const encrypted = localStorage.getItem(AnalyticsConfig.STORAGE_KEY);
            if (!encrypted) return [];
            const data = SecureStorage.decrypt(encrypted);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Unable to parse analytics snapshot', error);
            return [];
        }
    }
};

const Tracker = (() => {
    let currentSession = baseSession();
    let visibilityStart = document.visibilityState === 'visible' ? Date.now() : null;
    let lastSync = 0;
    let activeSection = null;
    let sectionEnterTime = null;

    const updateActiveTime = () => {
        if (visibilityStart) {
            const now = Date.now();
            currentSession.timeOnScreen += now - visibilityStart;
            visibilityStart = now;
        }
    };

    const recordSectionTime = () => {
        if (!activeSection || !sectionEnterTime) return;
        const diff = Date.now() - sectionEnterTime;
        const store = currentSession.sections[activeSection] || { time: 0, enters: 0 };
        store.time += diff;
        currentSession.sections[activeSection] = store;
        sectionEnterTime = Date.now();
    };

    const handleClick = (event) => {
        const payload = {
            x: event.clientX,
            y: event.clientY,
            target: event.target.tagName,
            text: event.target.innerText ? event.target.innerText.substring(0, 60) : '',
            timestamp: Date.now()
        };
        currentSession.clicks.push(payload);
        if (currentSession.clicks.length > 100) {
            currentSession.clicks.shift();
        }
        currentSession.events.push({ type: 'click', timestamp: payload.timestamp, label: payload.text });
        sync();
    };

    const handleScroll = () => {
        const scrollPercent = Math.min(100, Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100));
        if (scrollPercent > currentSession.scrollDepth) {
            currentSession.scrollDepth = scrollPercent;
        }
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            visibilityStart = Date.now();
        } else {
            updateActiveTime();
            visibilityStart = null;
            sync(true);
        }
    };

    const setupSectionObserver = () => {
        const sections = document.querySelectorAll('section[id]');
        if (!sections.length || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.intersectionRatio >= 0.5) {
                    if (activeSection && activeSection !== entry.target.id) {
                        recordSectionTime();
                    }
                    activeSection = entry.target.id;
                    sectionEnterTime = Date.now();
                    const store = currentSession.sections[activeSection] || { time: 0, enters: 0 };
                    store.enters += 1;
                    currentSession.sections[activeSection] = store;
                } else if (activeSection === entry.target.id) {
                    recordSectionTime();
                    activeSection = null;
                    sectionEnterTime = null;
                }
            });
        }, { threshold: [0.5] });

        sections.forEach(section => observer.observe(section));
    };

    const pushToRemote = (isFinal = false) => {
        if (!AnalyticsConfig.API_BASE) return;
        const payload = sanitizeSession();
        const endpoint = `${AnalyticsConfig.API_BASE.replace(/\/$/, '')}/collect`;
        const body = JSON.stringify(payload);
        if (navigator.sendBeacon && (isFinal || document.visibilityState === 'hidden')) {
            try {
                const blob = new Blob([body], { type: 'application/json' });
                navigator.sendBeacon(endpoint, blob);
            } catch (error) {
                console.error('sendBeacon failed', error);
            }
            return;
        }
        fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: isFinal
        }).catch(() => {});
    };

    const sanitizeSession = () => ({
        ...currentSession,
        timeOnScreen: Math.round(currentSession.timeOnScreen / 1000),
        sections: Object.fromEntries(Object.entries(currentSession.sections).map(([key, value]) => ([key, {
            time: Math.round(value.time / 1000),
            enters: value.enters
        }]))),
        events: currentSession.events.slice(-200)
    });

    const sync = (isVisibilityChange = false) => {
        updateActiveTime();
        if (activeSection && sectionEnterTime) {
            recordSectionTime();
        }

        let history = SecureStorage.load().filter(session => session.sessionId !== currentSession.sessionId);
        history.push(sanitizeSession());
        if (history.length > 100) history.shift();
        SecureStorage.save(history);

        const shouldPush = Date.now() - lastSync >= AnalyticsConfig.SYNC_INTERVAL || isVisibilityChange;
        if (shouldPush) {
            lastSync = Date.now();
            pushToRemote(isVisibilityChange);
        }
    };

    const endSession = () => {
        currentSession.endTime = Date.now();
        sync(true);
    };

    const init = () => {
        document.addEventListener('click', handleClick, { passive: true });
        document.addEventListener('scroll', handleScroll, { passive: true });
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', endSession, { passive: true });
        setupSectionObserver();
        setInterval(() => sync(false), AnalyticsConfig.SYNC_INTERVAL);
    };

    return { init, sanitizeSession };
})();

const shouldTrack = () => {
    const body = document.body;
    return !(body && body.dataset.disableTracking === 'true');
};

const bootstrapTracker = () => {
    if (!shouldTrack()) return;
    Tracker.init();
};

if (document.readyState === 'complete') {
    bootstrapTracker();
} else {
    window.addEventListener('load', bootstrapTracker, { once: true });
}
