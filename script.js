const { ipcRenderer } = require('electron');

const APP_BUILD_TAG = 'onboard-timetable-release-2.1.3-2026-08-21-26';
console.log(`[SimRail SIP by Urso] Build: ${APP_BUILD_TAG}`);

// ==========================================
// 1. ZEGAR, GŁOŚNOŚĆ I WSPÓLNY INTERFEJS
// ==========================================
let currentServerId = '';
let activeServerPcToServerDelta = 0; 
let currentTtsVolume = 1.0;
let appMode = 'onboard';
let activeServerCode = '';

const API_REQUEST_TIMEOUT_MS = 10000;
const API_LIVE_STALE_MS = 75000;
const API_CLOCK_STALE_MS = 75000;
const API_CLOCK_RECHECK_MS = 30000;
const liveSnapshotStateByServer = new Map();
const serverClockStateByServer = new Map();
let serverClockHealthInterval = null;
let selectedServerClockProblem = null;
let lastApiHttpSuccessAt = 0;

const setupScreen = document.getElementById('setup-screen');
const sipScreen = document.getElementById('sip-screen'); 
const stationScreen = document.getElementById('station-screen'); 

const modeOnboardBtn = document.getElementById('mode-onboard-btn');
const modeStationBtn = document.getElementById('mode-station-btn');
const onboardSetup = document.getElementById('onboard-setup');
const stationSetup = document.getElementById('station-setup');
const modeSelectionDiv = document.getElementById('mode-selection');

modeSelectionDiv.style.display = 'flex';
modeSelectionDiv.style.justifyContent = 'center';
modeSelectionDiv.style.gap = '20px';

modeOnboardBtn.style.flex = 'initial';
modeOnboardBtn.style.width = 'fit-content';
modeOnboardBtn.style.padding = '10px 30px';
modeOnboardBtn.style.margin = '0';

modeStationBtn.style.flex = 'initial';
modeStationBtn.style.width = 'fit-content';
modeStationBtn.style.padding = '10px 30px';
modeStationBtn.style.margin = '0';

const serverSelect = document.getElementById('server-select');
const refreshServersBtn = document.getElementById('refresh-servers-btn');
const startBtn = document.getElementById('start-btn');
const backBtns = document.querySelectorAll('.back-btn');

const settingsBtns = document.querySelectorAll('.settings-btn');
const volumePanels = document.querySelectorAll('.volume-panel');
const volumeSlidersArray = document.querySelectorAll('.volume-slider');
const randomStationAnnouncementsToggles = document.querySelectorAll('.random-station-announcements-toggle');

const RANDOM_STATION_ANNOUNCEMENTS_STORAGE_KEY = 'simrail-sip:random-station-announcements-enabled';
const RANDOM_STATION_ANNOUNCEMENT_INTERVAL_MS = 5 * 60000;
const RANDOM_STATION_ANNOUNCEMENT_RETRY_MS = 15000;
const RANDOM_STATION_ANNOUNCEMENTS = [
    'Informujemy, że na stacji obowiązuje zakaz palenia tytoniu oraz papierosów elektronicznych.',
    'Jeżeli jesteś świadkiem podejrzanego lub niebezpiecznego zachowania na stacji, pamiętaj o możliwości powiadomienia straży ochrony kolei.'
];

let randomStationAnnouncementsEnabled = true;
let randomStationAnnouncementTimer = null;

try {
    randomStationAnnouncementsEnabled = localStorage.getItem(RANDOM_STATION_ANNOUNCEMENTS_STORAGE_KEY) !== 'false';
} catch (err) {
    console.warn('[KOMUNIKATY LOSOWE] Nie udało się odczytać ustawienia:', err);
}

randomStationAnnouncementsToggles.forEach(toggle => {
    toggle.checked = randomStationAnnouncementsEnabled;
    toggle.addEventListener('change', () => {
        randomStationAnnouncementsEnabled = toggle.checked;
        randomStationAnnouncementsToggles.forEach(otherToggle => {
            otherToggle.checked = randomStationAnnouncementsEnabled;
        });

        try {
            localStorage.setItem(
                RANDOM_STATION_ANNOUNCEMENTS_STORAGE_KEY,
                String(randomStationAnnouncementsEnabled)
            );
        } catch (err) {
            console.warn('[KOMUNIKATY LOSOWE] Nie udało się zapisać ustawienia:', err);
        }

        if (randomStationAnnouncementsEnabled && isStationBoardVisible()) {
            scheduleRandomStationAnnouncement();
        } else {
            stopRandomStationAnnouncements();
        }
    });
});

let activeAudioElements = []; 

settingsBtns.forEach((btn, idx) => {
    btn.addEventListener('click', () => { volumePanels[idx].classList.toggle('hidden'); });
});
volumeSlidersArray.forEach(slider => {
    slider.addEventListener('input', (e) => { 
        currentTtsVolume = parseFloat(e.target.value); 
        volumeSlidersArray.forEach(s => s.value = e.target.value); 
        activeAudioElements.forEach(audio => {
            if (audio) audio.volume = currentTtsVolume;
        });
    });
});

volumePanels.forEach((panel) => {
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Testuj zapowiedź';
    testBtn.style.marginTop = '15px';
    testBtn.style.padding = '8px';
    testBtn.style.width = '100%';
    testBtn.style.cursor = 'pointer';
    testBtn.style.backgroundColor = '#4CAF50';
    testBtn.style.color = '#fff';
    testBtn.style.border = 'none';
    testBtn.style.borderRadius = '3px';
    testBtn.addEventListener('click', () => {
        playGongAndSpeak('To jest testowa zapowiedź systemu informacji pasażerskiej. Dźwięk działa poprawnie.', 'pl-PL-ZofiaNeural');
    });
    panel.appendChild(testBtn);

    const countdownElement = document.createElement('div');
    countdownElement.className = 'refresh-countdown';
    countdownElement.style.marginTop = '15px';
    countdownElement.style.color = '#ffcc00';
    countdownElement.style.fontSize = '13px';
    countdownElement.style.textAlign = 'center';
    countdownElement.style.display = 'none'; 
    countdownElement.textContent = 'Odświeżanie tablicy za: 15s';
    panel.appendChild(countdownElement);
});

const CHANGELOG_STORAGE_KEY = 'simrail-sip:last-shown-changelog-version';
const CHANGELOG_FALLBACK_VERSION = '2.1.3';
const whatsNewModal = document.getElementById('whats-new-modal');
const whatsNewVersion = document.getElementById('whats-new-version');
const closeWhatsNewButton = document.getElementById('close-whats-new');
const closeWhatsNewIcon = document.getElementById('close-whats-new-icon');
let currentAppVersion = CHANGELOG_FALLBACK_VERSION;

function rememberCurrentChangelogVersion() {
    try {
        localStorage.setItem(CHANGELOG_STORAGE_KEY, currentAppVersion);
    } catch (err) {
        console.warn('[CO NOWEGO] Nie udało się zapamiętać wyświetlonej wersji:', err);
    }
}

function openWhatsNewModal() {
    if (!whatsNewModal) return;

    whatsNewModal.classList.remove('hidden');
    requestAnimationFrame(() => closeWhatsNewButton?.focus());
}

function closeWhatsNewModal() {
    if (!whatsNewModal) return;

    whatsNewModal.classList.add('hidden');
    rememberCurrentChangelogVersion();
}

document.querySelectorAll('.whats-new-btn').forEach((button) => {
    button.addEventListener('click', () => {
        volumePanels.forEach(panel => panel.classList.add('hidden'));
        openWhatsNewModal();
    });
});

closeWhatsNewButton?.addEventListener('click', closeWhatsNewModal);
closeWhatsNewIcon?.addEventListener('click', closeWhatsNewModal);

whatsNewModal?.addEventListener('click', (event) => {
    if (event.target === whatsNewModal) closeWhatsNewModal();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && whatsNewModal && !whatsNewModal.classList.contains('hidden')) {
        closeWhatsNewModal();
    }
});

async function initializeWhatsNew() {
    try {
        const versionFromMain = await ipcRenderer.invoke('get-app-version');
        if (typeof versionFromMain === 'string' && versionFromMain.trim()) {
            currentAppVersion = versionFromMain.trim();
        }
    } catch (err) {
        console.warn('[CO NOWEGO] Nie udało się pobrać wersji aplikacji:', err);
    }

    if (whatsNewVersion) whatsNewVersion.textContent = `Wersja ${currentAppVersion}`;

    let lastShownVersion = null;
    try {
        lastShownVersion = localStorage.getItem(CHANGELOG_STORAGE_KEY);
    } catch (err) {
        console.warn('[CO NOWEGO] Nie udało się odczytać zapisanej wersji:', err);
    }

    if (lastShownVersion !== currentAppVersion) {
        setTimeout(openWhatsNewModal, 600);
    }
}

initializeWhatsNew();

const API_STATUS_COLORS = {
    ok: '#00e676',
    checking: '#ffcc00',
    warning: '#ff9800',
    error: '#ff5252'
};

const API_STATUS_AUTO_COLLAPSE_MS = 5000;
const API_STATUS_HINT_MS = 5000;
let apiStatusIntroStarted = false;
let apiStatusIntroFinished = false;
let apiStatusAutoCollapseTimer = null;
let apiStatusHintTimer = null;

function getApiStatusHintElement() {
    let hint = document.getElementById('api-health-hint');
    if (hint) return hint;

    hint = document.createElement('div');
    hint.id = 'api-health-hint';
    hint.textContent = 'Kliknij po szczegóły';
    hint.style.position = 'fixed';
    hint.style.left = '43px';
    hint.style.bottom = '8px';
    hint.style.zIndex = '9997';
    hint.style.padding = '6px 9px';
    hint.style.borderRadius = '6px';
    hint.style.fontSize = '12px';
    hint.style.fontWeight = '600';
    hint.style.color = '#ffffff';
    hint.style.background = 'rgba(0, 0, 0, 0.72)';
    hint.style.border = '1px solid rgba(255,255,255,0.18)';
    hint.style.pointerEvents = 'none';
    hint.style.userSelect = 'none';
    hint.style.display = 'none';
    hint.style.opacity = '0';
    hint.style.transition = 'opacity 0.2s ease';
    document.body.appendChild(hint);
    return hint;
}

function hideApiStatusHint() {
    if (apiStatusHintTimer) {
        clearTimeout(apiStatusHintTimer);
        apiStatusHintTimer = null;
    }

    const hint = document.getElementById('api-health-hint');
    if (!hint) return;
    hint.style.opacity = '0';
    setTimeout(() => {
        if (hint.style.opacity === '0') hint.style.display = 'none';
    }, 220);
}

function showApiStatusHint() {
    const hint = getApiStatusHintElement();
    if (apiStatusHintTimer) clearTimeout(apiStatusHintTimer);

    hint.style.display = 'block';
    requestAnimationFrame(() => {
        hint.style.opacity = '1';
    });

    apiStatusHintTimer = setTimeout(() => {
        hideApiStatusHint();
    }, API_STATUS_HINT_MS);
}

function renderApiStatusElement(el) {
    const state = el.dataset.state || 'checking';
    const message = el.dataset.message || 'API: sprawdzanie...';
    const collapsed = el.dataset.collapsed === 'true';
    const color = API_STATUS_COLORS[state] || '#ffffff';

    if (collapsed) {
        // Po zwinięciu zostaje tylko kolorowa kropka odpowiadająca stanowi API.
        el.textContent = '';
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.minWidth = '16px';
        el.style.padding = '0';
        el.style.borderRadius = '50%';
        el.style.background = color;
        el.style.border = '2px solid rgba(255,255,255,0.55)';
        el.style.boxShadow = `0 0 7px ${color}`;
        el.style.color = color;
        el.title = `${message}\nKliknij, aby rozwinąć informacje o API.`;
    } else {
        el.textContent = message;
        el.style.width = 'auto';
        el.style.height = 'auto';
        el.style.minWidth = '0';
        el.style.padding = '6px 10px';
        el.style.borderRadius = '6px';
        el.style.background = 'rgba(0, 0, 0, 0.65)';
        el.style.border = '1px solid rgba(255,255,255,0.18)';
        el.style.boxShadow = 'none';
        el.style.color = color;
        el.title = 'Kliknij, aby zwinąć informacje o API do kolorowej kropki.';
    }
}

function getApiStatusElement() {
    let el = document.getElementById('api-health-status');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'api-health-status';
    el.style.position = 'fixed';
    el.style.left = '15px';
    el.style.bottom = '10px';
    el.style.zIndex = '9998';
    el.style.fontSize = '13px';
    el.style.fontWeight = '600';
    el.style.lineHeight = '1.2';
    el.style.cursor = 'pointer';
    el.style.userSelect = 'none';
    el.style.pointerEvents = 'auto';
    el.style.display = 'none';
    el.style.transition = 'width 0.15s ease, height 0.15s ease, padding 0.15s ease, border-radius 0.15s ease, background 0.15s ease';
    el.dataset.collapsed = 'false';
    el.dataset.state = 'checking';
    el.dataset.message = 'API: sprawdzanie...';

    el.addEventListener('click', () => {
        // Od chwili ręcznej interakcji kontrolka działa już wyłącznie ręcznie.
        if (apiStatusAutoCollapseTimer) {
            clearTimeout(apiStatusAutoCollapseTimer);
            apiStatusAutoCollapseTimer = null;
        }
        apiStatusIntroFinished = true;
        hideApiStatusHint();

        el.dataset.collapsed = el.dataset.collapsed === 'true' ? 'false' : 'true';
        renderApiStatusElement(el);
    });

    document.body.appendChild(el);
    renderApiStatusElement(el);
    return el;
}

function startApiStatusIntroIfNeeded(el) {
    if (apiStatusIntroStarted || apiStatusIntroFinished) return;

    apiStatusIntroStarted = true;
    el.dataset.collapsed = 'false';
    renderApiStatusElement(el);

    apiStatusAutoCollapseTimer = setTimeout(() => {
        apiStatusAutoCollapseTimer = null;
        apiStatusIntroFinished = true;
        el.dataset.collapsed = 'true';
        renderApiStatusElement(el);
        showApiStatusHint();
    }, API_STATUS_AUTO_COLLAPSE_MS);
}

function setApiHealthStatus(state, message) {
    const el = getApiStatusElement();

    // Zmiana stanu API aktualizuje treść/kolor, ale po zakończeniu krótkiej
    // prezentacji startowej nie rozwija kontrolki automatycznie.
    el.dataset.state = state;
    el.dataset.message = message;
    el.style.display = 'block';
    renderApiStatusElement(el);
    startApiStatusIntroIfNeeded(el);
}

function makeApiError(message, code = 'API_ERROR') {
    const err = new Error(message);
    err.code = code;
    return err;
}

function parseApiTimestamp(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
        let n = value;
        if (n > 1000000000 && n < 100000000000) n *= 1000;
        return Number.isFinite(n) && n > 1000000000000 ? n : null;
    }

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

function getServerClockInfo(server) {
    const possibleProps = ['simulatorTime', 'simulatorTimeInMs', 'simulatedTime', 'serverTime', 'simTime'];

    for (const prop of possibleProps) {
        if (server[prop] === undefined || server[prop] === null) continue;
        const serverMs = parseApiTimestamp(server[prop]);
        if (serverMs === null) continue;

        // WAŻNE: serwer SimRail może mieć zupełnie inną datę i godzinę niż komputer.
        // Nie porównujemy go z czasem rzeczywistym. Różnica jest prawidłowa i służy
        // wyłącznie do ustawienia zegara aplikacji na czas wybranego serwera.
        return {
            delta: serverMs - Date.now(),
            serverMs,
            source: prop
        };
    }

    // W API SIT utcOffsetHours nie oznacza wyłącznie strefy czasowej. Dla serwerów
    // działających na innej dacie zawiera pełne przesunięcie osi czasu symulacji,
    // np. kilka tysięcy godzin. Używamy go do ustawienia czasu aplikacji, ale nie
    // traktujemy lastUpdated jako tykającego zegara. To pole może pozostawać stałe,
    // mimo że pozycje pociągów są nadal prawidłowo odświeżane.
    const timelineOffsetHours = Number(server.utcOffsetHours);
    if (Number.isFinite(timelineOffsetHours)) {
        const delta = timelineOffsetHours * 3600000;

        return {
            delta,
            serverMs: null,
            source: 'utcOffsetHours'
        };
    }

    // Brak zarówno bezpośredniego zegara, jak i przesunięcia czasu serwera.
    return { delta: 0, serverMs: null, source: 'system' };
}

function initializeServerClockSample(serverCode, serverMs) {
    if (!serverCode || serverMs === null) return;

    serverClockStateByServer.set(serverCode, {
        reportedMs: serverMs,
        changedAtReal: Date.now(),
        verified: false
    });
}

function observeServerClock(serverCode, serverMs) {
    if (!serverCode || serverMs === null) {
        return { ok: true, pending: true, reason: 'API nie udostępnia osobnego zegara tego serwera.' };
    }

    const nowReal = Date.now();
    const previous = serverClockStateByServer.get(serverCode);

    if (!previous) {
        initializeServerClockSample(serverCode, serverMs);
        return { ok: true, pending: true, reason: 'Sprawdzam, czy zegar serwera się odświeża.' };
    }

    // Nie interesuje nas, JAKA jest data/godzina serwera. Interesuje nas tylko,
    // czy wartość zwracana przez API zmienia się między kolejnymi odczytami.
    if (serverMs !== previous.reportedMs) {
        serverClockStateByServer.set(serverCode, {
            reportedMs: serverMs,
            changedAtReal: nowReal,
            verified: true
        });
        return { ok: true, pending: false };
    }

    if (nowReal - previous.changedAtReal >= API_CLOCK_STALE_MS) {
        return { ok: false, pending: false, reason: 'Zegar serwera w API przestał się odświeżać.' };
    }

    return {
        ok: true,
        pending: !previous.verified,
        reason: previous.verified ? '' : 'Czekam na zmianę zegara serwera, aby potwierdzić świeżość danych.'
    };
}

function buildActiveTrainsFingerprint(activeTrains) {
    if (!Array.isArray(activeTrains)) return { fingerprint: '', moving: false, liveCount: 0 };

    const rows = [];
    let moving = false;
    let liveCount = 0;

    for (const t of activeTrains) {
        const live = t?.liveData;
        const pos = live?.position;
        if (!live || !pos) continue;

        liveCount++;
        const speed = Number(live.speed) || 0;
        if (Math.abs(speed) > 1) moving = true;

        const lat = Number(pos.latitude);
        const lon = Number(pos.longitude);
        rows.push([
            t.journeyId || '',
            Number.isFinite(lat) ? lat.toFixed(5) : '',
            Number.isFinite(lon) ? lon.toFixed(5) : '',
            Math.round(speed),
            live.delay ?? ''
        ].join(':'));
    }

    rows.sort();
    return { fingerprint: rows.join('|'), moving, liveCount };
}

function assessActiveTrainsFreshness(activeTrains) {
    if (!Array.isArray(activeTrains)) {
        return { ok: false, pending: false, reason: 'API zwróciło nieprawidłowy format listy pociągów.' };
    }

    const serverKey = activeServerCode || currentServerId || 'unknown';
    const snapshot = buildActiveTrainsFingerprint(activeTrains);

    // Nie porównujemy godzin rozkładu z czasem Windowsa. Serwery mogą mieć inną
    // datę/godzinę. Zamrożenie wykrywamy po tym, czy liveData rzeczywiście się zmienia.
    if (snapshot.liveCount >= 2 && snapshot.fingerprint) {
        const previous = liveSnapshotStateByServer.get(serverKey);
        const nowReal = Date.now();

        if (!previous) {
            liveSnapshotStateByServer.set(serverKey, {
                fingerprint: snapshot.fingerprint,
                changedAt: nowReal,
                hadMotion: snapshot.moving,
                verified: false
            });
            return { ok: true, pending: true, reason: 'Sprawdzam, czy pozycje pociągów się odświeżają.' };
        }

        if (previous.fingerprint !== snapshot.fingerprint) {
            liveSnapshotStateByServer.set(serverKey, {
                fingerprint: snapshot.fingerprint,
                changedAt: nowReal,
                hadMotion: snapshot.moving,
                verified: true
            });
            return { ok: true, pending: false };
        }

        previous.hadMotion = previous.hadMotion || snapshot.moving;

        if (previous.hadMotion && nowReal - previous.changedAt >= API_LIVE_STALE_MS) {
            return { ok: false, pending: false, reason: 'Dane pozycji pociągów w API przestały się odświeżać.' };
        }

        return {
            ok: true,
            pending: !previous.verified,
            reason: previous.verified ? '' : 'Czekam na zmianę pozycji pociągów, aby potwierdzić świeżość danych.'
        };
    }

    // Brak wystarczającej liczby liveData nie oznacza awarii. Wtedy głównym
    // wskaźnikiem świeżości pozostaje zegar serwera.
    return { ok: true, pending: true, reason: 'Za mało danych GPS do niezależnej kontroli ruchu.' };
}

function isServerClockVerified() {
    if (!activeServerCode) return false;
    return serverClockStateByServer.get(activeServerCode)?.verified === true;
}

function isLiveDataVerified() {
    const serverKey = activeServerCode || currentServerId || 'unknown';
    return liveSnapshotStateByServer.get(serverKey)?.verified === true;
}

function validateActiveTrainsResponse(activeTrains) {
    const code = activeServerCode ? activeServerCode.toUpperCase() : '';

    if (selectedServerClockProblem) {
        const message = `API: NIEAKTUALNE DANE${code ? ` • ${code}` : ''} — ${selectedServerClockProblem}`;
        setApiHealthStatus('error', message);
        throw makeApiError(selectedServerClockProblem, 'STALE_API_DATA');
    }

    const assessment = assessActiveTrainsFreshness(activeTrains);

    if (!assessment.ok) {
        const message = `API: NIEAKTUALNE DANE${code ? ` • ${code}` : ''} — ${assessment.reason}`;
        setApiHealthStatus('error', message);
        throw makeApiError(assessment.reason, 'STALE_API_DATA');
    }

    if (isServerClockVerified() || isLiveDataVerified()) {
        setApiHealthStatus('ok', `API: OK${code ? ` • ${code}` : ''}`);
    } else {
        const reason = assessment.reason || 'weryfikuję świeżość danych';
        setApiHealthStatus('checking', `API: SPRAWDZANIE${code ? ` • ${code}` : ''} — ${reason}`);
    }

    return true;
}

async function refreshSelectedServerClockHealth(force = false) {
    if (!activeServerCode || !currentServerId) return true;

    const nowReal = Date.now();
    const state = serverClockStateByServer.get(activeServerCode);
    if (!force && state?.lastFetchAt && nowReal - state.lastFetchAt < API_CLOCK_RECHECK_MS) {
        return true;
    }

    const servers = await fetchJsonFresh(
        `${API_BASE}/sit-servers/v2/?includeOffline=false`,
        `Kontrola zegara ${activeServerCode.toUpperCase()}`
    );

    if (!Array.isArray(servers)) {
        throw makeApiError('Lista serwerów ma nieprawidłowy format.', 'API_FORMAT_ERROR');
    }

    const server = servers.find(s => String(s.code).toLowerCase() === String(activeServerCode).toLowerCase());
    if (!server) {
        selectedServerClockProblem = 'Wybrany serwer zniknął z listy aktywnych serwerów.';
        throw makeApiError(selectedServerClockProblem, 'STALE_API_DATA');
    }

    const clockInfo = getServerClockInfo(server);
    const previous = serverClockStateByServer.get(activeServerCode);
    const observation = observeServerClock(activeServerCode, clockInfo.serverMs);
    const updated = serverClockStateByServer.get(activeServerCode);
    if (updated) updated.lastFetchAt = nowReal;

    // Przesunięcie osi czasu może zmienić się po restarcie lub przestawieniu
    // symulacji. Aktualizujemy je niezależnie od tego, czy API udostępnia osobny,
    // możliwy do obserwowania zegar serwera.
    if (clockInfo.source === 'utcOffsetHours') {
        activeServerPcToServerDelta = clockInfo.delta;
        if (serversMap[activeServerCode]) {
            serversMap[activeServerCode].pcToServerDelta = activeServerPcToServerDelta;
        }
    }

    // Dopasowujemy zegar aplikacji do NOWEGO odczytu tylko wtedy, gdy jest to
    // pierwszy odczyt albo API faktycznie podało inną wartość. Przy zamrożonym
    // endpointcie nie cofamy zegara co 30 sekund do tej samej starej godziny.
    if (clockInfo.serverMs !== null && (!previous || clockInfo.serverMs !== previous.reportedMs)) {
        activeServerPcToServerDelta = clockInfo.delta;
        if (serversMap[activeServerCode]) {
            serversMap[activeServerCode].pcToServerDelta = activeServerPcToServerDelta;
            serversMap[activeServerCode].serverMs = clockInfo.serverMs;
        }
    }

    if (!observation.ok) {
        selectedServerClockProblem = observation.reason;
        const code = activeServerCode.toUpperCase();
        setApiHealthStatus('error', `API: NIEAKTUALNE DANE • ${code} — ${observation.reason}`);
        throw makeApiError(observation.reason, 'STALE_API_DATA');
    }

    selectedServerClockProblem = null;

    if (observation.pending && !isLiveDataVerified()) {
        setApiHealthStatus('checking', `API: SPRAWDZANIE • ${activeServerCode.toUpperCase()} — ${observation.reason}`);
    } else {
        setApiHealthStatus('ok', `API: OK • ${activeServerCode.toUpperCase()}`);
    }

    return true;
}

function startServerClockHealthMonitor() {
    if (serverClockHealthInterval) clearInterval(serverClockHealthInterval);
    serverClockHealthInterval = setInterval(() => {
        refreshSelectedServerClockHealth(true).catch(err => {
            console.error('[API] Kontrola zegara serwera:', err);
        });
    }, API_CLOCK_RECHECK_MS);
}

function getSimNow() {
    return new Date().getTime() + activeServerPcToServerDelta;
}

function formatServerTimeStr(dateMs) {
    if(!dateMs) return '--:--';

    // Daty rozkładowe bez informacji o strefie są godzinami ściennymi serwera.
    // toTimestamp zapisuje je na neutralnej osi UTC, dzięki czemu Windows nie
    // przesuwa ich według strefy komputera użytkownika.
    const serverTimelineMs = toTimestamp(dateMs);
    if (serverTimelineMs === null) return '--:--';

    const serverTime = new Date(serverTimelineMs);
    return `${String(serverTime.getUTCHours()).padStart(2, '0')}:${String(serverTime.getUTCMinutes()).padStart(2, '0')}`;
}

function updateClock() {
    let nowUtcMs = getSimNow();
    if (!currentServerId) nowUtcMs += (new Date().getTimezoneOffset() * -60000);
    const serverTime = new Date(nowUtcMs);
    const hours = String(serverTime.getUTCHours()).padStart(2, '0');
    const minutes = String(serverTime.getUTCMinutes()).padStart(2, '0');
    
    document.querySelectorAll('.clock').forEach(clockElement => {
        clockElement.innerHTML = `${hours}<span class="blink">:</span>${minutes}`;
    });
}
updateClock();
setInterval(updateClock, 1000);

function syncTimeWithActiveTrains(activeTrains) {
    // Nie próbujemy wyliczać czasu serwera z godzin pociągów i nie porównujemy
    // go z czasem komputera. Ta funkcja odpowiada wyłącznie za kontrolę liveData.
    validateActiveTrainsResponse(activeTrains);
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function formatTrainNumberForTTS(trainName) {
    return trainName.replace(/\d+/g, (match) => {
        let len = match.length;
        if (len === 4) return match.substring(0,2) + ", " + match.substring(2,4);
        if (len === 5) return match.substring(0,2) + ", " + match.substring(2,5);
        if (len === 6) return match.substring(0,3) + ", " + match.substring(3,6);
        return match;
    });
}

// ==========================================
// 2. SYSTEM AUDIO (GONG + TTS + KOLEJKOWANIE)
// ==========================================
let audioQueue = [];
let isPlayingAudio = false;
let activeStationTickerToken = 0;

function isStationBoardVisible() {
    return appMode === 'station' && stationScreen.style.display !== 'none';
}

function getStationAnnouncementTicker() {
    let ticker = document.getElementById('station-announcement-ticker');
    if (ticker) return ticker;

    ticker = document.createElement('div');
    ticker.id = 'station-announcement-ticker';
    ticker.className = 'station-announcement-ticker';
    ticker.hidden = true;
    ticker.setAttribute('aria-hidden', 'true');

    const textElement = document.createElement('div');
    textElement.className = 'station-announcement-ticker__text';
    ticker.appendChild(textElement);
    document.body.appendChild(ticker);

    return ticker;
}

function moveApiStatusAboveAnnouncementTicker(active) {
    const apiStatus = document.getElementById('api-health-status');
    const apiHint = document.getElementById('api-health-hint');

    if (apiStatus) {
        apiStatus.style.bottom = active ? '62px' : '10px';
        apiStatus.style.zIndex = active ? '10001' : '9998';
    }

    if (apiHint) {
        apiHint.style.bottom = active ? '60px' : '8px';
        apiHint.style.zIndex = active ? '10001' : '9997';
    }
}

function showStationAnnouncementTicker(text, durationSeconds) {
    if (!isStationBoardVisible() || !text) return null;

    const ticker = getStationAnnouncementTicker();
    const textElement = ticker.querySelector('.station-announcement-ticker__text');
    const token = ++activeStationTickerToken;
    const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
        ? Math.max(1, durationSeconds)
        : Math.max(4, text.length / 12);

    textElement.textContent = text;
    textElement.style.animation = 'none';
    ticker.hidden = false;
    ticker.setAttribute('aria-hidden', 'false');

    // Wymusza rozpoczęcie każdej zapowiedzi od prawej krawędzi ekranu.
    void textElement.offsetWidth;
    textElement.style.animation = `station-announcement-scroll ${safeDuration}s linear forwards`;
    moveApiStatusAboveAnnouncementTicker(true);

    return token;
}

function hideStationAnnouncementTicker(token = null) {
    if (token !== null && token !== activeStationTickerToken) return;

    const ticker = document.getElementById('station-announcement-ticker');
    if (ticker) {
        const textElement = ticker.querySelector('.station-announcement-ticker__text');
        if (textElement) {
            textElement.style.animation = 'none';
            textElement.textContent = '';
        }
        ticker.hidden = true;
        ticker.setAttribute('aria-hidden', 'true');
    }

    moveApiStatusAboveAnnouncementTicker(false);
}

function base64ToObjectUrl(base64, mimeType = 'audio/mpeg') {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
}

async function processAudioQueue() {
    if (isPlayingAudio || audioQueue.length === 0) return;
    isPlayingAudio = true;

    const { text, voice, withGong } = audioQueue.shift();

    try {
        if (withGong) {
            await new Promise((resolve) => {
                // gong.mp3 leży obok index.html, więc używamy ścieżki względnej.
                // Nie przekazujemy ścieżki Windows do file://.
                const gong = new Audio('gong.mp3');
                gong.volume = currentTtsVolume;
                activeAudioElements.push(gong);

                let finished = false;
                const finish = () => {
                    if (finished) return;
                    finished = true;
                    activeAudioElements = activeAudioElements.filter(a => a !== gong);
                    clearTimeout(timeout);
                    resolve();
                };

                const timeout = setTimeout(() => {
                    console.error('Timeout awaryjny odtwarzania gongu.');
                    finish();
                }, 5000);

                gong.onended = finish;
                gong.onerror = (e) => {
                    console.error('Błąd odtwarzania gongu:', e);
                    finish();
                };

                gong.play().catch((e) => {
                    console.error('gong.play() error:', e);
                    finish();
                });
            });
        }

        // TTS jest generowany w procesie głównym Electron.
        // main.js odczytuje MP3 do pamięci, usuwa plik TEMP
        // i zwraca rendererowi Base64 zamiast ścieżki do pliku.
        const response = await ipcRenderer.invoke('generate-tts', { text, voice });

        if (!response || !response.success) {
            throw new Error(`Błąd z main.js: ${response?.error || 'brak szczegółów'}`);
        }

        if (!response.audioBase64) {
            throw new Error('main.js nie zwrócił danych audio TTS.');
        }

        const audioUrl = base64ToObjectUrl(
            response.audioBase64,
            response.mimeType || 'audio/mpeg'
        );

        await new Promise((resolve) => {
            const audio = new Audio(audioUrl);
            audio.volume = currentTtsVolume;
            activeAudioElements.push(audio);

            let finished = false;
            let tickerToken = null;

            const cleanup = () => {
                if (finished) return;
                finished = true;

                activeAudioElements = activeAudioElements.filter(a => a !== audio);
                clearTimeout(timeout);
                hideStationAnnouncementTicker(tickerToken);

                try {
                    audio.pause();
                    audio.removeAttribute('src');
                    audio.load();
                } catch (e) {}

                URL.revokeObjectURL(audioUrl);
                resolve();
            };

            const timeout = setTimeout(() => {
                console.error('Timeout awaryjny odtwarzania TTS.');
                cleanup();
            }, 60000);

            audio.onended = cleanup;
            audio.onerror = (e) => {
                console.error('Błąd odtwarzania TTS (onerror):', e);
                cleanup();
            };

            audio.addEventListener('playing', () => {
                tickerToken = showStationAnnouncementTicker(text, audio.duration);
            }, { once: true });

            audio.play().catch((e) => {
                console.error('audio.play() error dla TTS:', e);
                cleanup();
            });
        });
    } catch (err) {
        console.error('=== BŁĄD SYSTEMU AUDIO ===');
        console.error('Wiadomość błędu:', err?.message || err);
        console.error('Tekst:', text ? text.substring(0, 80) + '...' : 'brak');
        console.error('Głos:', voice);
        console.error('==========================');

        // Podajemy w konsoli ścieżkę do logu z procesu głównego,
        // jeżeli Electron jest w stanie ją zwrócić.
        try {
            const logPath = await ipcRenderer.invoke('get-tts-log-path');
            console.error('Log TTS:', logPath);
        } catch (e) {}
    }

    isPlayingAudio = false;
    processAudioQueue();
}

function speakText(text, voice) {
    audioQueue.push({ text, voice, withGong: false });
    processAudioQueue();
}

function playGongAndSpeak(text, voice) {
    audioQueue.push({ text, voice, withGong: true });
    processAudioQueue();
}

function stopRandomStationAnnouncements() {
    if (!randomStationAnnouncementTimer) return;
    clearTimeout(randomStationAnnouncementTimer);
    randomStationAnnouncementTimer = null;
}

function scheduleRandomStationAnnouncement(delay = RANDOM_STATION_ANNOUNCEMENT_INTERVAL_MS) {
    stopRandomStationAnnouncements();

    if (!randomStationAnnouncementsEnabled || !isStationBoardVisible()) return;

    randomStationAnnouncementTimer = setTimeout(() => {
        randomStationAnnouncementTimer = null;

        if (!randomStationAnnouncementsEnabled || !isStationBoardVisible()) return;

        // Nie dokładamy komunikatu informacyjnego do zajętej kolejki. Jeżeli
        // trwa zapowiedź pociągu, czekamy na wolny system audio i próbujemy ponownie.
        if (isPlayingAudio || audioQueue.length > 0) {
            scheduleRandomStationAnnouncement(RANDOM_STATION_ANNOUNCEMENT_RETRY_MS);
            return;
        }

        const message = RANDOM_STATION_ANNOUNCEMENTS[
            Math.floor(Math.random() * RANDOM_STATION_ANNOUNCEMENTS.length)
        ];

        playGongAndSpeak(message, 'pl-PL-ZofiaNeural');
        console.log(`[STACJA] Odtwarzam losowy komunikat informacyjny: ${message}`);
        scheduleRandomStationAnnouncement();
    }, delay);
}

// ==========================================
// 3. LOGIKA MENU GŁÓWNEGO I WYBÓR TRYBU
// ==========================================
const API_BASE = 'https://apis.simrail.tools';
const TIMETABLE_API_BASE = 'https://api1.aws.simrail.eu:8082/api';
const TIMETABLE_REQUEST_TIMEOUT_MS = 30000;
const TIMETABLE_CACHE_TTL_MS = 15 * 60000;

// Dynamiczne dane SimRail nie mogą pochodzić z cache Chromium.
// Każde żądanie dostaje unikalny parametr czasu i cache: 'no-store'.
async function fetchJsonFresh(url, label = 'API') {
    const separator = url.includes('?') ? '&' : '?';
    const freshUrl = `${url}${separator}_ts=${Date.now()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(freshUrl, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
        });

        if (!response.ok) {
            throw makeApiError(`${label}: HTTP ${response.status} ${response.statusText}`, 'API_HTTP_ERROR');
        }

        const data = await response.json();
        lastApiHttpSuccessAt = Date.now();
        return data;
    } catch (err) {
        if (err?.name === 'AbortError') {
            setApiHealthStatus('error', `API: BRAK ODPOWIEDZI — ${label}`);
            throw makeApiError(`${label}: przekroczono ${API_REQUEST_TIMEOUT_MS / 1000}s oczekiwania na odpowiedź API.`, 'API_TIMEOUT');
        }

        if (err?.code !== 'STALE_API_DATA') {
            setApiHealthStatus('error', `API: BŁĄD POŁĄCZENIA — ${label}`);
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchFullServerTimetable(serverCode) {
    const normalizedServerCode = String(serverCode || '').trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalizedServerCode)) {
        throw makeApiError('Nieprawidłowy kod serwera dla rozkładu jazdy.', 'API_FORMAT_ERROR');
    }

    if (
        fullServerTimetableCache &&
        fullServerTimetableCache.serverCode === normalizedServerCode &&
        Date.now() - fullServerTimetableCache.fetchedAt < TIMETABLE_CACHE_TTL_MS
    ) {
        return fullServerTimetableCache.data;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMETABLE_REQUEST_TIMEOUT_MS);
    const url = `${TIMETABLE_API_BASE}/getAllTimetables?serverCode=${encodeURIComponent(normalizedServerCode)}&_ts=${Date.now()}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
        });

        if (!response.ok) {
            throw makeApiError(`Pełny rozkład: HTTP ${response.status} ${response.statusText}`, 'API_HTTP_ERROR');
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw makeApiError('Pełny rozkład ma nieprawidłowy format.', 'API_FORMAT_ERROR');
        }

        fullServerTimetableCache = {
            serverCode: normalizedServerCode,
            fetchedAt: Date.now(),
            data
        };

        return data;
    } catch (err) {
        if (err?.name === 'AbortError') {
            throw makeApiError(`Pełny rozkład: przekroczono ${TIMETABLE_REQUEST_TIMEOUT_MS / 1000}s oczekiwania.`, 'API_TIMEOUT');
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

let serversMap = {}; 
let trackingInterval = null;
let boardRefreshInterval = null;
let countdownInterval = null;
let refreshCountdown = 15;

let allPassengerTrains = []; 
let activeJourneyId = '';
let activeDestination = ''; 
let activeTrainType = ''; 
let targetStationList = [];

let activeStationName = '';
let stationTimetable = [];
let departedHistory = []; 
let cancelledHistory = [];
let knownJourneyIds = new Set(); 
let isSyncing = false;
let globalActiveTrainsCount = 0; 
let availableServers = [];
let fullServerTimetableCache = null;

const trainSearch = document.getElementById('train-search');
const trainTypeFilter = document.getElementById('train-type-filter');
const trainSelect = document.getElementById('train-select');
const refreshTrainsBtn = document.getElementById('refresh-trains-btn');
const stationSelect = document.getElementById('station-select');
const stationSearchInput = document.getElementById('station-search');
const favoriteServerBtn = document.getElementById('favorite-server-btn');
const favoriteStationBtn = document.getElementById('favorite-station-btn');

stationSelect.size = 8; 
stationSelect.style.width = '100%';
stationSelect.style.marginTop = '5px';

const FAVORITE_SERVERS_STORAGE_KEY = 'simrail-sip:favorite-servers';
const FAVORITE_STATIONS_STORAGE_KEY = 'simrail-sip:favorite-stations';

function readFavoriteSet(storageKey) {
    try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
        return new Set(Array.isArray(stored) ? stored.filter(value => typeof value === 'string') : []);
    } catch (err) {
        console.warn(`[ULUBIONE] Nie udało się odczytać ${storageKey}:`, err);
        return new Set();
    }
}

function saveFavoriteSet(storageKey, values) {
    try {
        localStorage.setItem(storageKey, JSON.stringify([...values]));
    } catch (err) {
        console.warn(`[ULUBIONE] Nie udało się zapisać ${storageKey}:`, err);
    }
}

const favoriteServerCodes = readFavoriteSet(FAVORITE_SERVERS_STORAGE_KEY);
const favoriteStationNames = readFavoriteSet(FAVORITE_STATIONS_STORAGE_KEY);

function updateFavoriteServerButton() {
    const serverCode = serverSelect.value;
    const isFavorite = Boolean(serverCode) && favoriteServerCodes.has(serverCode);
    favoriteServerBtn.disabled = !serverCode;
    favoriteServerBtn.textContent = isFavorite ? '★' : '☆';
    favoriteServerBtn.classList.toggle('is-favorite', isFavorite);
    favoriteServerBtn.title = isFavorite
        ? 'Usuń wybrany serwer z ulubionych'
        : 'Dodaj wybrany serwer do ulubionych';
}

function updateFavoriteStationButton() {
    const stationName = stationSelect.value;
    const isFavorite = Boolean(stationName) && favoriteStationNames.has(stationName);
    favoriteStationBtn.disabled = stationSelect.disabled || !stationName;
    favoriteStationBtn.textContent = isFavorite ? '★' : '☆';
    favoriteStationBtn.classList.toggle('is-favorite', isFavorite);
    favoriteStationBtn.title = isFavorite
        ? 'Usuń wybraną stację z ulubionych'
        : 'Dodaj wybraną stację do ulubionych';
}

function renderServerOptions(selectedCode = serverSelect.value) {
    serverSelect.innerHTML = '<option value="">-- Wybierz serwer --</option>';

    [...availableServers]
        .sort((a, b) => {
            const favoriteDifference = Number(favoriteServerCodes.has(b.code)) - Number(favoriteServerCodes.has(a.code));
            return favoriteDifference || a.code.localeCompare(b.code);
        })
        .forEach(srv => {
            const opt = document.createElement('option');
            opt.value = srv.code;
            opt.textContent = `${favoriteServerCodes.has(srv.code) ? '★ ' : ''}${srv.code.toUpperCase()} - Serwer Aktywny`;
            serverSelect.appendChild(opt);
        });

    if (selectedCode && serversMap[selectedCode]) serverSelect.value = selectedCode;
    updateFavoriteServerButton();
}

const stationListRaw = [
    "Baby", "Będzin", "Bukowno", "Bełchów", "Dąbrowa Górnicza", "Dąbrowa Górnicza Wschodnia", 
    "Dąbrowa Górnicza Ząbkowice", "Gajewniki", "Gałkówek", "Głowno", "Grodzisk Mazowiecki", 
    "Katowice", "Katowice Zawodzie", "Koluszki", "Kozłów", "Kraków Batowice", "Łask", "Łazy", 
    "Łowicz Główny", "Łowicz Przedmieście", "Łódź Chojny", "Łódź Fabryczna", "Łódź Kaliska", 
    "Łódź Lublinek", "Łódź Widzew", "Łódź Żabieniec", "Miechów", "Niedźwiedź", "Opoczno Południe", 
    "Pabianice", "Pruszków", "Płyćwia", "Raciborowice", "Retkinia", "Rogów", "Rokiciny", "Skierniewice", 
    "Sławków", "Słomniki", "Sosnowiec Główny", "Sosnowiec Kazimierz", "Sosnowiec Południowy", 
    "Tunel", "Warszawa Włochy", "Witonia", "Włoszczowa Północ", "Zastów", "Zawiercie", 
    "Zduńska Wola", "Zgierz", "Zgierz Północ"
];

function loadStaticStations(filterText = "") {
    const selectedStation = stationSelect.value;
    stationSelect.innerHTML = '';
    const query = filterText.toLowerCase();
    const filtered = stationListRaw
        .filter(st => st.toLowerCase().includes(query))
        .sort((a, b) => {
            const favoriteDifference = Number(favoriteStationNames.has(b)) - Number(favoriteStationNames.has(a));
            return favoriteDifference || a.localeCompare(b);
        });
    
    if (filtered.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "Brak stacji";
        opt.disabled = true;
        stationSelect.appendChild(opt);
    } else {
        filtered.forEach(st => {
            const opt = document.createElement('option');
            opt.value = st;
            opt.textContent = `${favoriteStationNames.has(st) ? '★ ' : ''}${st}`;
            stationSelect.appendChild(opt);
        });

        if (selectedStation && filtered.includes(selectedStation)) {
            stationSelect.value = selectedStation;
        }
    }

    updateFavoriteStationButton();
}

stationSearchInput.addEventListener('input', (e) => {
    loadStaticStations(e.target.value);
    checkStartCondition();
});

favoriteServerBtn.addEventListener('click', () => {
    const serverCode = serverSelect.value;
    if (!serverCode) return;

    if (favoriteServerCodes.has(serverCode)) favoriteServerCodes.delete(serverCode);
    else favoriteServerCodes.add(serverCode);

    saveFavoriteSet(FAVORITE_SERVERS_STORAGE_KEY, favoriteServerCodes);
    renderServerOptions(serverCode);
});

favoriteStationBtn.addEventListener('click', () => {
    const stationName = stationSelect.value;
    if (!stationName) return;

    if (favoriteStationNames.has(stationName)) favoriteStationNames.delete(stationName);
    else favoriteStationNames.add(stationName);

    saveFavoriteSet(FAVORITE_STATIONS_STORAGE_KEY, favoriteStationNames);
    loadStaticStations(stationSearchInput.value);
    stationSelect.value = stationName;
    updateFavoriteStationButton();
    checkStartCondition();
});

modeOnboardBtn.addEventListener('click', () => {
    appMode = 'onboard';
    modeOnboardBtn.classList.add('active');
    modeStationBtn.classList.remove('active');
    onboardSetup.style.display = 'flex';
    stationSetup.style.display = 'none';
    checkStartCondition();
});

modeStationBtn.addEventListener('click', () => {
    appMode = 'station';
    modeStationBtn.classList.add('active');
    modeOnboardBtn.classList.remove('active');
    onboardSetup.style.display = 'none';
    stationSetup.style.display = 'flex';
    checkStartCondition();
});

async function loadServers() {
    try {
        setApiHealthStatus('checking', 'API: sprawdzanie dostępności...');
        serverSelect.innerHTML = '<option value="">Ładowanie...</option>';
        refreshServersBtn.disabled = true;
        modeSelectionDiv.classList.add('disabled');
        serversMap = {};
        availableServers = [];
        activeServerCode = '';
        liveSnapshotStateByServer.clear();
        serverClockStateByServer.clear();
        selectedServerClockProblem = null;
        if (serverClockHealthInterval) {
            clearInterval(serverClockHealthInterval);
            serverClockHealthInterval = null;
        }
        
        trainSearch.value = '';
        trainSearch.placeholder = '-- Wybierz serwer najpierw --';
        trainSearch.disabled = true;
        trainTypeFilter.disabled = true;
        trainSelect.innerHTML = '<option value="">-- Wybierz serwer najpierw --</option>';
        trainSelect.disabled = true;
        refreshTrainsBtn.disabled = true;
        allPassengerTrains = [];
        
        stationSelect.disabled = true;
        stationSelect.value = '';
        stationSearchInput.disabled = true;
        startBtn.disabled = true;
        
        loadStaticStations();
        
        const servers = await fetchJsonFresh(
            `${API_BASE}/sit-servers/v2/?includeOffline=false`,
            'Lista serwerów'
        );

        if (!Array.isArray(servers)) {
            throw makeApiError('Lista serwerów ma nieprawidłowy format.', 'API_FORMAT_ERROR');
        }
        
        availableServers = servers;
        servers.forEach(srv => {
            const clockInfo = getServerClockInfo(srv);

            serversMap[srv.code] = { 
                id: srv.id, 
                pcToServerDelta: clockInfo.delta,
                clockSource: clockInfo.source,
                serverMs: clockInfo.serverMs
            };

            initializeServerClockSample(srv.code, clockInfo.serverMs);
        });

        renderServerOptions();

        setApiHealthStatus('ok', 'API: dostępne • wybierz serwer');
        refreshServersBtn.disabled = false;
    } catch (err) {
        console.error('[API] Nie udało się pobrać listy serwerów:', err);
        serverSelect.innerHTML = '<option value="">Błąd API SIT</option>';
        modeSelectionDiv.classList.add('disabled');
        stationSelect.disabled = true;
        stationSearchInput.disabled = true;
        startBtn.disabled = true;
        refreshServersBtn.disabled = false;
        setApiHealthStatus('error', 'API: NIEDOSTĘPNE — nie udało się pobrać listy serwerów');
    }
}

refreshServersBtn.addEventListener('click', loadServers);

serverSelect.addEventListener('change', async () => {
    updateFavoriteServerButton();
    modeSelectionDiv.classList.add('disabled');
    stationSelect.disabled = true;
    stationSearchInput.disabled = true;
    startBtn.disabled = true;
    trainSearch.disabled = true;
    trainTypeFilter.disabled = true;
    trainSelect.disabled = true;
    refreshTrainsBtn.disabled = true;

    if (!serverSelect.value) {
        activeServerCode = '';
        currentServerId = '';
        selectedServerClockProblem = null;
        if (serverClockHealthInterval) { clearInterval(serverClockHealthInterval); serverClockHealthInterval = null; }
        setApiHealthStatus('ok', 'API: dostępne • wybierz serwer');
        updateFavoriteStationButton();
        return;
    }

    const sData = serversMap[serverSelect.value];
    activeServerCode = serverSelect.value;
    currentServerId = sData.id;
    activeServerPcToServerDelta = sData.pcToServerDelta;

    selectedServerClockProblem = null;
    liveSnapshotStateByServer.delete(activeServerCode);
    setApiHealthStatus('checking', `API: sprawdzanie ${activeServerCode.toUpperCase()}...`);

    try {
        // Pierwsza kontrola porównuje aktualny odczyt zegara serwera z próbką
        // pobraną przy wczytywaniu listy. Nie ma znaczenia, czy serwer ma dziś
        // inną datę lub godzinę niż komputer użytkownika.
        await refreshSelectedServerClockHealth(true);
        startServerClockHealthMonitor();

        const healthTrains = await fetchJsonFresh(
            `${API_BASE}/sit-journeys/v2/active?serverId=${currentServerId}`,
            `Test serwera ${activeServerCode.toUpperCase()}`
        );
        syncTimeWithActiveTrains(healthTrains);

        modeSelectionDiv.classList.remove('disabled');
        stationSelect.disabled = false;
        stationSearchInput.disabled = false;
        updateFavoriteStationButton();

        // Lista pociągów dla trybu pokładowego pobierze świeży zestaw jeszcze raz.
        await loadTrainsForOnboard(serverSelect.value);
        checkStartCondition();
    } catch (err) {
        console.error(`[API] Serwer ${activeServerCode.toUpperCase()} nie przeszedł kontroli świeżości:`, err);
        modeSelectionDiv.classList.add('disabled');
        stationSelect.disabled = true;
        stationSearchInput.disabled = true;
        trainSearch.disabled = true;
        trainTypeFilter.disabled = true;
        trainSelect.disabled = true;
        refreshTrainsBtn.disabled = true;
        startBtn.disabled = true;

        const reason = err?.code === 'STALE_API_DATA'
            ? 'API zwraca nieaktualne dane. Poczekaj na przywrócenie działania i kliknij odśwież.'
            : 'Brak poprawnego połączenia z API. Kliknij odśwież i spróbuj ponownie.';

        trainSelect.innerHTML = `<option value="">${reason}</option>`;
    }
});

stationSelect.addEventListener('change', () => {
    updateFavoriteStationButton();
    checkStartCondition();
});
trainSelect.addEventListener('change', checkStartCondition);

function checkStartCondition() {
    if (appMode === 'onboard') {
        startBtn.disabled = (trainSelect.value === "");
    } else {
        startBtn.disabled = (stationSelect.value === "");
    }
}

startBtn.addEventListener('click', async () => {
    if (appMode === 'onboard') await startOnboardMode();
    else await startStationMode();
});

backBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (trackingInterval) clearInterval(trackingInterval);
        if (boardRefreshInterval) clearInterval(boardRefreshInterval);
        if (countdownInterval) clearInterval(countdownInterval);
        stopRandomStationAnnouncements();
        document.querySelectorAll('.refresh-countdown').forEach(el => el.style.display = 'none');
        
        const nextStationEl = document.querySelector('.next-station');
        if(nextStationEl) nextStationEl.textContent = '...';
        const etaTimeEl = document.querySelector('.eta .time');
        if(etaTimeEl) etaTimeEl.textContent = '--:--';
        const speedValEl = document.querySelector('.speed-value');
        if(speedValEl) speedValEl.textContent = '0';
        const ulEl = document.querySelector('.route-list ul');
        if(ulEl) ulEl.innerHTML = '';
        const tbody = document.getElementById('station-departures-body');
        if(tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">Zatrzymano system stacyjny.</td></tr>';
        hideStationAnnouncementTicker();
        document.getElementById('departed-modal').style.display = 'none';
        document.getElementById('cancelled-modal').style.display = 'none';
        
        sipScreen.style.display = 'none';
        stationScreen.style.display = 'none';
        setupScreen.style.display = 'flex';
    });
});

document.getElementById('departed-btn').addEventListener('click', () => {
    renderDepartedModal();
    document.getElementById('departed-modal').style.display = 'flex';
});
document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('departed-modal').style.display = 'none';
});
document.getElementById('cancelled-btn').addEventListener('click', () => {
    renderCancelledModal();
    document.getElementById('cancelled-modal').style.display = 'flex';
});
document.getElementById('close-cancelled-modal').addEventListener('click', () => {
    document.getElementById('cancelled-modal').style.display = 'none';
});

function renderDepartedModal() {
    const list = document.getElementById('departed-list');
    list.innerHTML = '';
    const now = getSimNow();
    departedHistory.sort((a,b) => b.departedAt - a.departedAt);

    if (departedHistory.length === 0) {
        list.innerHTML = '<li>Brak pociągów, które odjechały.</li>';
        return;
    }

    departedHistory.forEach(t => {
        const mins = Math.floor((now - t.departedAt) / 60000);
        const li = document.createElement('li');
        li.innerHTML = `<strong>${t.time} ${t.trainName}</strong> do stacji ${t.destination} <br> <span style="color:#ffcc00">Odjechał ${mins} minut temu</span>`;
        list.appendChild(li);
    });
}

function getStationRecordHistoryKey(t) {
    return t.journeyId || t.scheduleRunId || `${t.trainName}:${t.rawDepTime}`;
}

function removeTrainFromCancelledHistory(t) {
    const historyKey = getStationRecordHistoryKey(t);
    cancelledHistory = cancelledHistory.filter(item => item.historyKey !== historyKey);
}

function addTrainToCancelledHistory(t, cancelledAt) {
    const historyKey = getStationRecordHistoryKey(t);
    if (cancelledHistory.some(item => item.historyKey === historyKey)) return;

    cancelledHistory.push({
        ...t,
        historyKey,
        cancelledAt
    });
}

function renderCancelledModal() {
    const list = document.getElementById('cancelled-list');
    list.innerHTML = '';
    const now = getSimNow();
    cancelledHistory.sort((a, b) => b.cancelledAt - a.cancelledAt);

    if (cancelledHistory.length === 0) {
        list.innerHTML = '<li>Brak pociągów odwołanych podczas bieżącej pracy tablicy.</li>';
        return;
    }

    cancelledHistory.forEach(t => {
        const mins = Math.max(0, Math.floor((now - t.cancelledAt) / 60000));
        const li = document.createElement('li');
        li.innerHTML = `<strong>${t.time} ${t.trainName}</strong> do stacji ${t.destination}<br><span style="color:#ff4444">Odwołany ${mins} minut temu</span>`;
        list.appendChild(li);
    });
}

// ==========================================
// 4. TRYB STACYJNY (DYŻURNY RUCHU)
// ==========================================
const STATION_REFRESH_MS = 15000;
const STATION_GPS_AT_PLATFORM_METERS = 300;
const STATION_ANNOUNCE_DISTANCE_METERS = 1000;
const STATION_DELAY_ANNOUNCEMENT_MINUTES = 5;
const STATION_MISSING_LIMIT = 4; // 4 x 15 s = ok. 60 s przed uznaniem pociągu za odwołany
const STATION_DEPARTURE_FALLBACK_MS = 3 * 60000;

// Tylko te typy trafiają na tablicę i korzystają z zapowiedzi pasażerskich.
// Inne składy mogą być śledzone wyłącznie po to, aby ostrzec o przejeździe
// bez zatrzymania. Ich postoje techniczne nadal są całkowicie pomijane.
const PASSENGER_TRAIN_TYPES = new Set([
    'NATIONAL_EXPRESS_TRAIN',
    'INTER_NATIONAL_EXPRESS_TRAIN',
    'INTER_REGIONAL_EXPRESS_TRAIN',
    'INTER_REGIONAL_TRAIN',
    'REGIONAL_FAST_TRAIN',
    'REGIONAL_TRAIN'
]);

function isPassengerTrainType(type) {
    return PASSENGER_TRAIN_TYPES.has(String(type || '').trim());
}

function isPassengerActiveTrain(train) {
    return isPassengerTrainType(train?.originEvent?.transport?.type);
}

function getStationStopType(event) {
    return String(event?.stopType || '').trim().toUpperCase();
}

function isCommercialStationStopEvent(event) {
    return getStationStopType(event) === 'PASSENGER';
}

function isTechnicalStationStopEvent(event) {
    return getStationStopType(event) === 'TECHNICAL';
}

const LONG_DISTANCE_EXPRESS_TYPES = new Set([
    'NATIONAL_EXPRESS_TRAIN',
    'INTER_NATIONAL_EXPRESS_TRAIN'
]);

function containsTrainCategory(value, category) {
    return String(value || '').toUpperCase().includes(String(category || '').toUpperCase());
}

// W SimRail oznaczenie EIJ jest współdzielone przez dwa różne rodzaje pociągów.
// Rozróżniamy je po typie transportu z API:
// - EIJ + typ dalekobieżny => Pendolino / Express InterCity Premium,
// - EIJ + pozostały typ pasażerski => regionalny pośpieszny ŁKA.
function isEijPendolino(type, ...labels) {
    const isEij = labels.some(label => containsTrainCategory(label, 'EIJ'));
    return isEij && LONG_DISTANCE_EXPRESS_TYPES.has(String(type || '').trim());
}

function isEijRegionalLka(type, ...labels) {
    const isEij = labels.some(label => containsTrainCategory(label, 'EIJ'));
    return isEij && !isEijPendolino(type, ...labels);
}

function isExpressTrainForUi(type, ...labels) {
    const hasEip = labels.some(label => containsTrainCategory(label, 'EIP'));
    const hasMpe = labels.some(label => containsTrainCategory(label, 'MPE'));
    const hasLs = labels.some(label => containsTrainCategory(label, 'ŁS'));

    if (hasEip || hasMpe || isEijPendolino(type, ...labels)) return true;
    if (hasLs || isEijRegionalLka(type, ...labels)) return false;

    return LONG_DISTANCE_EXPRESS_TYPES.has(String(type || '').trim());
}

function normalizeDelayMinutes(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.round(number));
}

function toTimestamp(value) {
    if (!value) return null;

    // API rozkładowe zwracają czas serwera bez oznaczenia strefy (np. 13:42).
    // Zamieniamy taki zapis na wspólną oś czasu, odwracając przesunięcie używane
    // przez zegar serwera. Dzięki temu porównania nie zależą od strefy Windowsa.
    if (typeof value === 'string') {
        const match = value.trim().match(
            /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/
        );

        if (match) {
            const [, year, month, day, hour, minute, second = '0', millisecond = '0'] = match;
            const serverWallClockUtc = Date.UTC(
                Number(year),
                Number(month) - 1,
                Number(day),
                Number(hour),
                Number(minute),
                Number(second),
                Number(millisecond.slice(0, 3).padEnd(3, '0'))
            );
            return serverWallClockUtc;
        }
    }

    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}

// Opóźnienie dla tablicy stacyjnej musi pochodzić z konkretnego zdarzenia
// na WYBRANEJ STACJI. liveData.delay z listy aktywnych pociągów opisuje
// bieżący stan pociągu na trasie i może być inny niż prognoza dla stacji.
function getSignedStationEventDelayMinutes(event) {
    if (!event) return null;

    const realtimeMs = toTimestamp(event.realtimeTime);
    const scheduledMs = toTimestamp(event.scheduledTime);

    if (realtimeMs === null || scheduledMs === null) return null;

    const value = (realtimeMs - scheduledMs) / 60000;
    return Number.isFinite(value) ? Math.round(value) : null;
}

function getRelevantStationDelayMinutes(arrEvent, depEvent, departureContext = false) {
    const primaryEvent = departureContext ? (depEvent || arrEvent) : (arrEvent || depEvent);
    const secondaryEvent = departureContext ? arrEvent : depEvent;

    const primaryDelay = getSignedStationEventDelayMinutes(primaryEvent);
    if (primaryDelay !== null) return primaryDelay;

    return getSignedStationEventDelayMinutes(secondaryEvent);
}

async function refreshStationSpecificRealtime(t) {
    try {
        const data = await fetchJsonFresh(
            `${API_BASE}/sit-journeys/v2/by-id/${t.journeyId}`,
            `Aktualizacja stacji ${t.journeyId}`
        );

        if (!data || !Array.isArray(data.events)) return;

        const normalizedActiveStation = activeStationName.trim().toLowerCase();
        const allStationEvs = data.events.filter(ev =>
            ev.stopPlace &&
            ev.stopPlace.name &&
            ev.stopPlace.name.trim().toLowerCase() === normalizedActiveStation
        );

        if (allStationEvs.length === 0) return;

        const stationEvs = allStationEvs.filter(isCommercialStationStopEvent);
        if (stationEvs.length === 0) {
            // Usuwamy rekord tylko wtedy, gdy API jednoznacznie zmieniło postój
            // handlowy na techniczny. Brak danych nie może usuwać pociągu z tablicy.
            if (allStationEvs.some(isTechnicalStationStopEvent)) {
                t.technicalStopOnly = true;
            }
            return;
        }

        t.technicalStopOnly = false;

        const arrEvent = stationEvs.find(e => e.type === 'ARRIVAL') || null;
        const depEvent = stationEvs.find(e => e.type === 'DEPARTURE') || null;
        const mainEvent = arrEvent || depEvent || stationEvs[0];

        const signedDelay = getRelevantStationDelayMinutes(
            arrEvent,
            depEvent,
            t.gpsStatus === 'Na stacji'
        );

        if (signedDelay !== null) {
            t.stationSignedDelayMin = signedDelay;
            t.delayMin = Math.max(0, signedDelay);
        }

        const arrRealtimeTime = arrEvent ? toTimestamp(arrEvent.realtimeTime) : null;
        const depRealtimeTime = depEvent ? toTimestamp(depEvent.realtimeTime) : null;

        if (arrRealtimeTime !== null) {
            t.actualArrTime = arrRealtimeTime;
        } else if (t.rawArrTime && signedDelay !== null) {
            t.actualArrTime = t.rawArrTime + signedDelay * 60000;
        }

        if (depRealtimeTime !== null) {
            t.actualDepTime = depRealtimeTime;
        } else if (t.rawDepTime && signedDelay !== null) {
            t.actualDepTime = t.rawDepTime + signedDelay * 60000;
        }

        if (!t.rawArrTime) t.actualArrTime = t.actualDepTime;
        if (t.actualDepTime < t.actualArrTime) t.actualDepTime = t.actualArrTime;

        const stationLocation = extractStationPlatformTrack(stationEvs, mainEvent, null);
        if (stationLocation.platform) t.platform = stationLocation.platform;
        if (stationLocation.track) t.track = stationLocation.track;
    } catch (err) {
        // Chwilowy błąd szczegółów jednego pociągu nie może zatrzymać całej tablicy.
        console.warn(`[STACJA] Nie udało się odświeżyć danych stacyjnych ${t.trainName}:`, err);
    }
}

function getStationTrainSpeechInfo(t) {
    let trainType = 'pociąg regionalny';
    let reservationSuffix = '';

    if (isEijPendolino(t.trainTypeRaw, t.trainCategory, t.trainName)) {
        trainType = 'pociąg Express Intercity Premium';
        reservationSuffix = ' Pociąg jest objęty obowiązkową rezerwacją miejsc.';
    } else if (isEijRegionalLka(t.trainTypeRaw, t.trainCategory, t.trainName)) {
        trainType = 'pociąg regionalny pośpieszny ŁKA';
    } else if (t.trainCategory.includes('EIP') || t.trainName.includes('EIP')) {
        trainType = 'pociąg dalekobieżny intercity';
        reservationSuffix = ' Pociąg jest objęty obowiązkową rezerwacją miejsc.';
    } else if (t.trainCategory.includes('Łs') || t.trainName.includes('Łs')) {
        trainType = 'pociąg pośpieszny';
    } else if (t.trainCategory.includes('MPE')) {
        trainType = 'pociąg dalekobieżny TLK';
        reservationSuffix = ' Pociąg jest objęty obowiązkową rezerwacją miejsc.';
    } else if (LONG_DISTANCE_EXPRESS_TYPES.has(t.trainTypeRaw)) {
        trainType = 'pociąg pospieszny Intercity';
        reservationSuffix = ' Pociąg jest objęty obowiązkową rezerwacją miejsc.';
    }

    const rawNumber = t.trainName.split(' ')[1] || t.trainName;
    const number = formatTrainNumberForTTS(rawNumber);
    const viaText = t.viaText ? `, przez stacje: ${t.viaText}` : '';

    return { trainType, reservationSuffix, number, viaText };
}

// API SimRail może zwracać numer peronu jako liczbę rzymską (np. II),
// a numer toru jako liczbę. Te funkcje sprowadzają oba formaty do jednej postaci.
function romanToInteger(value) {
    if (value === null || value === undefined) return null;

    const roman = String(value).trim().toUpperCase();
    if (!roman || !/^[IVXLCDM]+$/.test(roman)) return null;

    const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let total = 0;
    let previous = 0;

    for (let i = roman.length - 1; i >= 0; i--) {
        const current = values[roman[i]];
        if (current < previous) total -= current;
        else {
            total += current;
            previous = current;
        }
    }

    return total > 0 ? total : null;
}

function parseStationNumber(value) {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const directNumber = Number(raw.replace(',', '.'));
    if (Number.isFinite(directNumber) && directNumber > 0) {
        return Math.round(directNumber);
    }

    const digitMatch = raw.match(/\d+/);
    if (digitMatch) {
        const parsed = Number(digitMatch[0]);
        if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
    }

    const romanMatch = raw.toUpperCase().match(/\b[IVXLCDM]+\b/);
    if (romanMatch) return romanToInteger(romanMatch[0]);

    return null;
}

function normalizeStationLocationValue(value) {
    if (value === null || value === undefined) return null;

    const parsed = parseStationNumber(value);
    if (parsed !== null) return String(parsed);

    const raw = String(value).trim();
    return raw || null;
}

// Odmiana liczebników porządkowych w miejscowniku:
// 1 -> pierwszym, 2 -> drugim, 21 -> dwudziestym pierwszym itd.
function ordinalLocativePolish(value) {
    const number = parseStationNumber(value);
    if (number === null || number < 1) return null;

    const underTwenty = {
        1: 'pierwszym',
        2: 'drugim',
        3: 'trzecim',
        4: 'czwartym',
        5: 'piątym',
        6: 'szóstym',
        7: 'siódmym',
        8: 'ósmym',
        9: 'dziewiątym',
        10: 'dziesiątym',
        11: 'jedenastym',
        12: 'dwunastym',
        13: 'trzynastym',
        14: 'czternastym',
        15: 'piętnastym',
        16: 'szesnastym',
        17: 'siedemnastym',
        18: 'osiemnastym',
        19: 'dziewiętnastym'
    };

    const tensOrdinal = {
        20: 'dwudziestym',
        30: 'trzydziestym',
        40: 'czterdziestym',
        50: 'pięćdziesiątym',
        60: 'sześćdziesiątym',
        70: 'siedemdziesiątym',
        80: 'osiemdziesiątym',
        90: 'dziewięćdziesiątym'
    };

    const hundredCardinal = {
        1: 'sto',
        2: 'dwieście',
        3: 'trzysta',
        4: 'czterysta',
        5: 'pięćset',
        6: 'sześćset',
        7: 'siedemset',
        8: 'osiemset',
        9: 'dziewięćset'
    };

    const hundredOrdinal = {
        100: 'setnym',
        200: 'dwusetnym',
        300: 'trzechsetnym',
        400: 'czterechsetnym',
        500: 'pięćsetnym',
        600: 'sześćsetnym',
        700: 'siedemsetnym',
        800: 'osiemsetnym',
        900: 'dziewięćsetnym'
    };

    if (number < 20) return underTwenty[number];

    if (number < 100) {
        const tens = Math.floor(number / 10) * 10;
        const ones = number % 10;
        if (ones === 0) return tensOrdinal[tens] || String(number);
        return `${tensOrdinal[tens]} ${underTwenty[ones]}`;
    }

    if (number < 1000) {
        const hundreds = Math.floor(number / 100);
        const rest = number % 100;
        if (rest === 0) return hundredOrdinal[number] || String(number);
        return `${hundredCardinal[hundreds]} ${ordinalLocativePolish(rest)}`;
    }

    // Tory/perony o takich numerach praktycznie nie występują, ale nie blokujemy TTS.
    return String(number);
}

function getFirstNestedValue(source, keyNames, maxDepth = 4) {
    if (!source || typeof source !== 'object') return null;

    const wanted = new Set(keyNames.map(k => k.toLowerCase()));
    const seen = new WeakSet();

    function walk(value, depth) {
        if (!value || typeof value !== 'object' || depth > maxDepth) return null;
        if (seen.has(value)) return null;
        seen.add(value);

        for (const [key, child] of Object.entries(value)) {
            if (
                wanted.has(key.toLowerCase()) &&
                child !== null &&
                child !== undefined &&
                String(child).trim() !== ''
            ) {
                return child;
            }
        }

        for (const child of Object.values(value)) {
            if (child && typeof child === 'object') {
                const found = walk(child, depth + 1);
                if (found !== null) return found;
            }
        }

        return null;
    }

    return walk(source, 0);
}

function extractStationPlatformTrack(stationEvents, mainEvent, trainActiveData = null) {
    const events = [
        mainEvent,
        ...(Array.isArray(stationEvents) ? stationEvents : [])
    ].filter(Boolean);

    const platformKeys = [
        'platform',
        'scheduledPlatform',
        'plannedPlatform',
        'platformNumber',
        'platformNo'
    ];

    const trackKeys = [
        'track',
        'scheduledTrack',
        'plannedTrack',
        'trackNumber',
        'trackNo'
    ];

    let platform = null;
    let track = null;

    for (const event of events) {
        if (platform === null) {
            platform = getFirstNestedValue(event, platformKeys);
        }
        if (track === null) {
            track = getFirstNestedValue(event, trackKeys);
        }
        if (platform !== null && track !== null) break;
    }

    // liveData jest tylko awaryjnym źródłem, jeśli wpis rozkładowy nie zawiera danych.
    if (platform === null && trainActiveData) {
        platform = getFirstNestedValue(trainActiveData, platformKeys, 3);
    }
    if (track === null && trainActiveData) {
        track = getFirstNestedValue(trainActiveData, trackKeys, 3);
    }

    return {
        platform: normalizeStationLocationValue(platform),
        track: normalizeStationLocationValue(track)
    };
}

function buildStationLocationSpeech(t, departureContext = false) {
    const platform = ordinalLocativePolish(t.platform);
    const track = ordinalLocativePolish(t.track);

    if (!platform && !track) return '';

    if (departureContext) {
        if (platform && track) {
            return ` Odjazd pociągu nastąpi przy peronie ${platform}, na torze ${track}.`;
        }
        if (platform) {
            return ` Odjazd pociągu nastąpi przy peronie ${platform}.`;
        }
        return ` Odjazd pociągu nastąpi na torze ${track}.`;
    }

    if (platform && track) {
        return ` Pociąg zatrzyma się przy peronie ${platform}, na torze ${track}.`;
    }
    if (platform) {
        return ` Pociąg zatrzyma się przy peronie ${platform}.`;
    }
    return ` Pociąg zatrzyma się na torze ${track}.`;
}

function ensureStationPlatformTrackColumns() {
    const headerRow = document.querySelector('.plk-table thead tr');
    if (!headerRow || headerRow.dataset.platformTrackReady === '1') return;

    headerRow.innerHTML = `
        <th style="width: 120px;">Godzina<br><span class="en">Time</span></th>
        <th style="width: 230px;">Pociąg<br><span class="en">Train</span></th>
        <th>Kierunek / Przez<br><span class="en">Destination / Via</span></th>
        <th style="width: 90px; text-align: center;">Peron<br><span class="en">Platform</span></th>
        <th style="width: 90px; text-align: center;">Tor<br><span class="en">Track</span></th>
        <th style="width: 230px; text-align: right;">Status<br><span class="en">Status</span></th>
    `;
    headerRow.dataset.platformTrackReady = '1';
}

function buildStationStandardAnnouncement(t) {
    const { trainType, reservationSuffix, number, viaText } = getStationTrainSpeechInfo(t);
    const className = trainType.charAt(0).toUpperCase() + trainType.slice(1);

    // Na stacji początkowej lub gdy pociąg już stoi przy peronie mówimy o odjeździe.
    const departureContext = !t.rawArrTime || t.gpsStatus === 'Na stacji';
    const locationSpeech = buildStationLocationSpeech(t, departureContext);

    if (departureContext) {
        const time = formatServerTimeStr(t.actualDepTime);
        return `${className}, ${number} do stacji ${t.destination}${viaText}, odjedzie o godzinie ${time}.${locationSpeech}${reservationSuffix}`;
    }

    const time = formatServerTimeStr(t.actualArrTime);
    return `${className}, ${number} do stacji ${t.destination}${viaText}, przyjedzie o godzinie ${time}.${locationSpeech}${reservationSuffix} Prosimy zachować ostrożność i nie zbliżać się do krawędzi peronu.`;
}

function buildStationDelayAnnouncement(t) {
    const { trainType, number } = getStationTrainSpeechInfo(t);
    const className = trainType.charAt(0).toUpperCase() + trainType.slice(1);
    const departureContext = !t.rawArrTime || t.gpsStatus === 'Na stacji';
    const scheduledTime = departureContext ? t.rawDepTime : t.rawArrTime;
    const timeToSpeak = formatServerTimeStr(scheduledTime);
    const eventWord = departureContext ? 'odjazd' : 'przyjazd';
    const eventAction = departureContext ? 'odjedzie' : 'przyjedzie';

    // Komunikat o zmianie opóźnienia nie podaje peronu ani toru.
    // Informacja lokalizacyjna pozostaje w zapowiedzi wjazdu i odjazdu ze stacji.
    return `Uwaga. ${className} ${number}, planowy ${eventWord} pociągu o godzinie ${timeToSpeak}, ${eventAction} z opóźnieniem około ${t.delayMin} minut. Opóźnienie może ulec zmianie.`;
}

const SCHEDULED_TRAIN_TYPE_MAP = {
    ECE: 'INTER_NATIONAL_EXPRESS_TRAIN',
    EIE: 'NATIONAL_EXPRESS_TRAIN',
    EIJ: 'NATIONAL_EXPRESS_TRAIN',
    MHE: 'INTER_REGIONAL_EXPRESS_TRAIN',
    MPE: 'INTER_REGIONAL_EXPRESS_TRAIN',
    MOE: 'INTER_REGIONAL_TRAIN',
    MOJ: 'INTER_REGIONAL_TRAIN',
    RAJ: 'REGIONAL_TRAIN',
    ROE: 'REGIONAL_TRAIN',
    ROJ: 'REGIONAL_TRAIN',
    RPJ: 'REGIONAL_FAST_TRAIN',
    RPP: 'REGIONAL_FAST_TRAIN'
};

function normalizeStationName(value) {
    return String(value || '').trim().toLocaleLowerCase('pl-PL');
}

function normalizeTrainIdentifier(value) {
    const normalized = String(value || '').toUpperCase().replace(/\s+/g, '');
    return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, '') : normalized;
}

function isOfficialCommercialStop(row) {
    return String(row?.stopType || '').trim().toLowerCase() === 'commercialstop';
}

function mapScheduledTrainType(category) {
    return SCHEDULED_TRAIN_TYPE_MAP[String(category || '').trim().toUpperCase()] || 'REGIONAL_TRAIN';
}

function getScheduledViaText(timetable, stationIndex) {
    const viaStations = timetable
        .slice(stationIndex + 1)
        .filter(isOfficialCommercialStop)
        .map(row => row.nameForPerson || row.nameOfPoint)
        .filter(Boolean);

    if (viaStations.length === 0) return '';

    let viaText = viaStations[0];
    if (viaStations.length > 2) {
        viaText += `, ${viaStations[Math.floor(viaStations.length / 2)]}`;
    }
    return viaText;
}

function findScheduledStationRecord(activeTrain, rawDepTime) {
    const activeNumbers = new Set([
        activeTrain?.originEvent?.transport?.number,
        activeTrain?.destinationEvent?.transport?.number
    ].map(normalizeTrainIdentifier).filter(Boolean));

    const candidates = stationTimetable.filter(record =>
        record.fromFullSchedule &&
        !record.seenOnMap &&
        !record.notSpawnedExpired &&
        record.trainNumberKeys.some(number => activeNumbers.has(number))
    );

    if (candidates.length === 0) return null;

    candidates.sort((a, b) =>
        Math.abs(a.rawDepTime - rawDepTime) - Math.abs(b.rawDepTime - rawDepTime)
    );
    return candidates[0];
}

async function loadScheduledStationTimetable() {
    const fullTimetable = await fetchFullServerTimetable(activeServerCode);
    const normalizedStation = normalizeStationName(activeStationName);
    const now = getSimNow();
    const scheduledEntries = [];

    fullTimetable.forEach(train => {
        const timetable = Array.isArray(train?.timetable) ? train.timetable : [];
        const stationIndex = timetable.findIndex(row =>
            isOfficialCommercialStop(row) &&
            [row.nameForPerson, row.nameOfPoint].some(name => normalizeStationName(name) === normalizedStation)
        );

        if (stationIndex === -1) return;

        const stationStop = timetable[stationIndex];
        const firstRoutePoint = timetable.find(row => row?.departureTime || row?.arrivalTime);
        const scheduledStartTime = toTimestamp(firstRoutePoint?.departureTime || firstRoutePoint?.arrivalTime);
        const rawArrTime = toTimestamp(stationStop.arrivalTime);
        const rawDepTime = toTimestamp(stationStop.departureTime) || rawArrTime;

        if (scheduledStartTime === null || rawDepTime === null) return;

        // Pociąg niewidoczny na mapie pokazujemy wyłącznie przed jego planowym
        // uruchomieniem. Aktywne pociągi są za chwilę scalane z danymi mapy.
        if (scheduledStartTime <= now || rawDepTime <= now) return;

        const category = String(stationStop.trainType || train.trainName || 'POC').split(/\s+-\s+/)[0].trim();
        const displayedNumber = stationStop.displayedTrainNumber || train.trainNoLocal || train.trainNoInternational || '0';
        const trainNumberKeys = [
            train.trainNoLocal,
            train.trainNoInternational,
            stationStop.displayedTrainNumber
        ].map(normalizeTrainIdentifier).filter(Boolean);

        scheduledEntries.push({
            journeyId: `scheduled:${train.runId || displayedNumber}:${stationStop.pointId || stationIndex}`,
            scheduleRunId: train.runId || '',
            scheduledStartTime,
            trainNumberKeys: [...new Set(trainNumberKeys)],
            fromFullSchedule: true,
            seenOnMap: false,
            notSpawnedExpired: false,
            time: formatServerTimeStr(rawDepTime),
            rawArrTime,
            rawDepTime,
            actualArrTime: rawArrTime || rawDepTime,
            actualDepTime: rawDepTime,
            stLat: 0,
            stLon: 0,
            currentDist: Infinity,
            gpsStatus: 'Zaplanowany',
            departedAt: 0,
            trainName: `${category} ${displayedNumber}`,
            trainCategory: category,
            trainTypeRaw: mapScheduledTrainType(category),
            destination: train.endStation || 'Nieznana',
            viaText: getScheduledViaText(timetable, stationIndex),
            platform: stationStop.platform || null,
            track: stationStop.track || null,
            delayMin: 0,
            stationSignedDelayMin: 0,
            lastDelaySpoken: 0,
            technicalStopOnly: false,
            isPassing: false,
            futureEvents: [],
            announced: false,
            departureAnnounced: false,
            departedAdded: false,
            cancelled: false,
            cancelledTime: 0,
            missingCount: 0
        });
    });

    stationTimetable.push(...scheduledEntries);
    console.log(`[STACJA] Wczytano ${scheduledEntries.length} przyszłych postojów handlowych dla ${activeStationName}.`);
    return scheduledEntries.length;
}

function getDisplayedStationJourneyIds() {
    return new Set(
        [...stationTimetable]
            .filter(t => !t.isPassing && !t.notSpawnedExpired && isPassengerTrainType(t.trainTypeRaw))
            .sort((a, b) => a.actualDepTime - b.actualDepTime)
            .slice(0, 10)
            .map(t => t.journeyId)
    );
}

async function startStationMode() {
    activeStationName = stationSelect.value;
    ensureStationPlatformTrackColumns();
    setupScreen.style.display = 'none';
    stationScreen.style.display = 'flex';
    scheduleRandomStationAnnouncement();
    departedHistory = [];
    cancelledHistory = [];
    document.querySelector('.plk-station-name').textContent = `STACJA: ${activeStationName}`;

    document.querySelectorAll('.refresh-countdown').forEach(el => el.style.display = 'block');
    refreshCountdown = 15;
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        refreshCountdown--;
        if (refreshCountdown <= 0) refreshCountdown = 15;
        document.querySelectorAll('.refresh-countdown').forEach(el => el.textContent = `Odświeżanie danych za: ${refreshCountdown}s`);
    }, 1000);

    await fetchStationTimetable();
    startStationLiveTracking();

    if (boardRefreshInterval) clearInterval(boardRefreshInterval);
    boardRefreshInterval = setInterval(() => {
        if (!isSyncing) renderStationBoard();
    }, 30000);
}

async function fetchStationTimetable() {
    const tbody = document.getElementById('station-departures-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #ffcc00;">Pobieranie pełnego rozkładu stacji...</td></tr>';

    stationTimetable = [];
    knownJourneyIds = new Set();

    try {
        await loadScheduledStationTimetable();
        renderStationBoard();
    } catch (err) {
        // Brak pełnego rozkładu nie blokuje dotychczasowego trybu opartego na mapie.
        console.warn('[STACJA] Nie udało się pobrać pełnego rozkładu. Używam danych aktywnych pociągów:', err);
    }

    try {
        const activeTrains = await fetchJsonFresh(
            `${API_BASE}/sit-journeys/v2/active?serverId=${currentServerId}`,
            'Aktywne pociągi - stacja'
        );

        syncTimeWithActiveTrains(activeTrains);
        globalActiveTrainsCount = activeTrains ? activeTrains.length : 0;

        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #ffcc00;">Skanowanie mapy pociągów...<br><small style="color:#aaa;">(Wykryto ${globalActiveTrainsCount} aktywnych składów na serwerze)</small></td></tr>`;

        await syncNewTrains(activeTrains);
    } catch (err) {
        console.error('[STACJA] Błąd pobierania rozkładu:', err);
        if (stationTimetable.length > 0) {
            renderStationBoard();
        } else {
            const text = err?.code === 'STALE_API_DATA'
                ? 'API zwraca nieaktualne dane. Tablica nie będzie korzystać ze starej migawki.'
                : 'Błąd połączenia z API. Spróbuj ponownie po przywróceniu działania usługi.';
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:#ff5252;">${text}</td></tr>`;
        }
    }
}

async function syncNewTrains(activeTrains) {
    if (isSyncing || !Array.isArray(activeTrains)) return;
    isSyncing = true;

    try {
        // Sprawdzamy rozkład każdego nowego składu z mapy. Sam typ pociągu nie
        // wystarcza do odrzucenia go w tym miejscu: także pociąg towarowy może
        // przejeżdżać przez wybraną stację i wymagać ostrzeżenia. O tym, czy
        // rekord trafi na tablicę, decydują dopiero zdarzenia konkretnej stacji.
        const newTrains = activeTrains.filter(t =>
            t?.journeyId && !knownJourneyIds.has(t.journeyId)
        );
        if (newTrains.length === 0) return;

        const chunkSize = 15;
        const normalizedActiveStation = activeStationName.trim().toLowerCase();
        const now = getSimNow();

        for (let i = 0; i < newTrains.length; i += chunkSize) {
            const chunk = newTrains.slice(i, i + chunkSize);

            await Promise.all(chunk.map(async (t) => {
                let detailsLoaded = false;

                try {
                    const data = await fetchJsonFresh(
                        `${API_BASE}/sit-journeys/v2/by-id/${t.journeyId}`,
                        `Rozkład pociągu ${t.journeyId}`
                    );

                    if (!data || !Array.isArray(data.events)) {
                        throw new Error(`Brak poprawnej listy events dla ${t.journeyId}`);
                    }

                    // Dopiero poprawnie pobrany rozkład uznajemy za sprawdzony.
                    // Dzięki temu chwilowy błąd API nie usuwa pociągu z kolejnych prób.
                    detailsLoaded = true;

                    const allStationEvs = data.events.filter(ev =>
                        ev.stopPlace &&
                        ev.stopPlace.name &&
                        ev.stopPlace.name.trim().toLowerCase() === normalizedActiveStation
                    );

                    if (allStationEvs.length === 0) return;

                    const commercialStationEvs = allStationEvs.filter(isCommercialStationStopEvent);

                    // Postój techniczny nie jest przeznaczony dla pasażerów, dlatego pociąg
                    // nie może trafić na tablicę ani wywoływać zapowiedzi stacyjnych.
                    if (
                        commercialStationEvs.length === 0 &&
                        allStationEvs.some(isTechnicalStationStopEvent)
                    ) {
                        console.log(`[STACJA] Pominięto postój techniczny ${t.journeyId} na stacji ${activeStationName}.`);
                        return;
                    }

                    // Dla postoju handlowego korzystamy wyłącznie ze zdarzeń PASSENGER.
                    // Zdarzenia PASSING/NONE pozostają obsługiwane przez ostrzeżenie o przejeździe.
                    const stationEvs = commercialStationEvs.length > 0
                        ? commercialStationEvs
                        : allStationEvs;

                    const arrEvent = stationEvs.find(e => e.type === 'ARRIVAL') || null;
                    const depEvent = stationEvs.find(e => e.type === 'DEPARTURE') || null;
                    const mainEvent = arrEvent || depEvent || stationEvs[0];
                    const isPassing = (
                        mainEvent.stopType === 'PASSING' ||
                        mainEvent.stopType === 'NONE' ||
                        mainEvent.type === 'PASSING' ||
                        (!arrEvent && !depEvent)
                    );

                    // Pociąg niepasażerski interesuje tryb stacyjny tylko wtedy,
                    // gdy przejeżdża bez zatrzymania. Nie pokazujemy go na tablicy
                    // ani nie odtwarzamy dla niego zwykłej zapowiedzi pociągu.
                    if (!isPassengerActiveTrain(t) && !isPassing) {
                        console.log(`[STACJA] Pominięto niepasażerski postój ${t.journeyId} na stacji ${activeStationName}.`);
                        return;
                    }

                    const liveDelay = t.liveData && t.liveData.delay !== undefined
                        ? normalizeDelayMinutes(t.liveData.delay)
                        : null;

                    // Dla tablicy interesuje nas opóźnienie W TEJ KONKRETNEJ STACJI.
                    // Najpierw bierzemy realtimeTime - scheduledTime z ARRIVAL/DEPARTURE.
                    // liveData.delay jest tylko awaryjnym fallbackiem, gdy zdarzenie stacyjne
                    // nie ma jeszcze własnego czasu rzeczywistego.
                    const signedStationDelay = getRelevantStationDelayMinutes(arrEvent, depEvent, false);
                    const delay = signedStationDelay !== null
                        ? Math.max(0, signedStationDelay)
                        : (liveDelay !== null ? liveDelay : 0);

                    // raw* = CZAS PLANOWY. To ważne: opóźnienia nie wolno doliczać do realtimeTime,
                    // bo wtedy byłoby naliczane podwójnie.
                    const mainScheduledTime = toTimestamp(mainEvent.scheduledTime) || toTimestamp(mainEvent.realtimeTime);
                    const rawArrTime = arrEvent
                        ? (toTimestamp(arrEvent.scheduledTime) || toTimestamp(arrEvent.realtimeTime))
                        : null;
                    const rawDepTime = depEvent
                        ? (toTimestamp(depEvent.scheduledTime) || toTimestamp(depEvent.realtimeTime))
                        : (rawArrTime || mainScheduledTime || now);

                    const arrRealtimeTime = arrEvent ? toTimestamp(arrEvent.realtimeTime) : null;
                    const depRealtimeTime = depEvent ? toTimestamp(depEvent.realtimeTime) : null;
                    const mainRealtimeTime = toTimestamp(mainEvent.realtimeTime);

                    let actualArrTime;
                    let actualDepTime;

                    if (rawArrTime) {
                        actualArrTime = arrRealtimeTime || (rawArrTime + delay * 60000);
                    } else {
                        actualArrTime = mainRealtimeTime || (rawDepTime + delay * 60000);
                    }

                    actualDepTime = depRealtimeTime || mainRealtimeTime || (rawDepTime + delay * 60000);

                    // Przy zwykłym postoju odjazd nie może być wcześniejszy od przyjazdu.
                    if (actualDepTime < actualArrTime) actualDepTime = actualArrTime;

                    const destEvent = data.events[data.events.length - 1];
                    const destName = destEvent?.stopPlace?.name || t.destinationEvent?.stopPlace?.name || 'Nieznana';
                    const myIndex = data.events.indexOf(mainEvent);
                    const futureEvents = data.events.slice(myIndex + 1, -1);

                    // Peron i tor są przypisane do konkretnego punktu rozkładu, nie do całego pociągu.
                    // Sprawdzamy wszystkie zdarzenia tej stacji, bo w API informacja może znajdować się
                    // np. przy DEPARTURE, podczas gdy mainEvent jest ARRIVAL.
                    const stationLocation = extractStationPlatformTrack(stationEvs, mainEvent, t.liveData || null);
                    const plat = stationLocation.platform;
                    const trk = stationLocation.track;

                    if (!plat && !trk) {
                        console.warn(`[STACJA] Brak danych o peronie i torze dla ${t.journeyId} na stacji ${activeStationName}.`);
                    }

                    const stLat = mainEvent.stopPlace?.position?.latitude || 0;
                    const stLon = mainEvent.stopPlace?.position?.longitude || 0;

                    const viaArray = futureEvents
                        .filter(e => isCommercialStationStopEvent(e) && e.stopPlace?.name)
                        .map(e => e.stopPlace.name)
                        .filter(name => name.toLowerCase() !== activeStationName.toLowerCase());

                    let viaText = '';
                    if (viaArray.length > 0) {
                        viaText = viaArray[0];
                        if (viaArray.length > 2) viaText += `, ${viaArray[Math.floor(viaArray.length / 2)]}`;
                    }

                    if (!stationTimetable.some(existing => existing.journeyId === t.journeyId)) {
                        const scheduledRecord = !isPassing
                            ? findScheduledStationRecord(t, rawDepTime)
                            : null;
                        const effectiveRawArrTime = scheduledRecord?.rawArrTime ?? rawArrTime;
                        const effectiveRawDepTime = scheduledRecord?.rawDepTime ?? rawDepTime;
                        const stationShiftMinutes = signedStationDelay !== null ? signedStationDelay : delay;
                        const effectiveActualArrTime = scheduledRecord
                            ? ((effectiveRawArrTime || effectiveRawDepTime) + stationShiftMinutes * 60000)
                            : actualArrTime;
                        const effectiveActualDepTime = scheduledRecord
                            ? Math.max(effectiveActualArrTime, effectiveRawDepTime + stationShiftMinutes * 60000)
                            : actualDepTime;
                        const activeTrainNumber = t.originEvent?.transport?.number || '0';
                        const activeTrainNumberKeys = [
                            ...(scheduledRecord?.trainNumberKeys || []),
                            normalizeTrainIdentifier(activeTrainNumber)
                        ].filter(Boolean);

                        const activeRecordData = {
                            journeyId: t.journeyId,
                            scheduleRunId: scheduledRecord?.scheduleRunId || '',
                            scheduledStartTime: scheduledRecord?.scheduledStartTime || toTimestamp(data.events[0]?.scheduledTime),
                            trainNumberKeys: [...new Set(activeTrainNumberKeys)],
                            fromFullSchedule: Boolean(scheduledRecord?.fromFullSchedule),
                            seenOnMap: true,
                            notSpawnedExpired: false,
                            time: formatServerTimeStr(effectiveRawDepTime),
                            rawArrTime: effectiveRawArrTime,
                            rawDepTime: effectiveRawDepTime,
                            actualArrTime: effectiveActualArrTime,
                            actualDepTime: effectiveActualDepTime,
                            stLat,
                            stLon,
                            currentDist: Infinity,
                            gpsStatus: 'Oczekuje',
                            departedAt: scheduledRecord?.departedAt || 0,
                            trainName: `${t.originEvent?.transport?.category || 'POC'} ${activeTrainNumber}`,
                            trainCategory: t.originEvent?.transport?.category || 'POC',
                            trainTypeRaw: t.originEvent?.transport?.type || 'UNKNOWN',
                            destination: destName,
                            viaText: viaText || scheduledRecord?.viaText || '',
                            platform: plat || scheduledRecord?.platform || null,
                            track: trk || scheduledRecord?.track || null,
                            delayMin: delay,
                            stationSignedDelayMin: signedStationDelay,
                            // Zapamiętujemy opóźnienie zastane przy pierwszym wykryciu pociągu.
                            // Komunikat pojawi się dopiero po kolejnej zmianie wartości.
                            lastDelaySpoken: delay,
                            technicalStopOnly: false,
                            isPassing,
                            futureEvents,
                            announced: scheduledRecord?.announced || false,
                            departureAnnounced: scheduledRecord?.departureAnnounced || false,
                            departedAdded: false,
                            cancelled: false,
                            cancelledTime: 0,
                            missingCount: 0
                        };

                        if (effectiveActualDepTime + 60000 > now) {
                            removeTrainFromCancelledHistory(activeRecordData);
                            if (scheduledRecord) {
                                Object.assign(scheduledRecord, activeRecordData);
                            } else {
                                stationTimetable.push(activeRecordData);
                            }
                        }
                    }
                } catch (err) {
                    console.error(`[STACJA] Nie udało się przeskanować pociągu ${t.journeyId}:`, err);
                } finally {
                    if (detailsLoaded) knownJourneyIds.add(t.journeyId);
                }
            }));
        }

        renderStationBoard();
    } finally {
        isSyncing = false;
    }
}

function renderStationBoard() {
    const tbody = document.getElementById('station-departures-body');
    tbody.innerHTML = '';
    const now = getSimNow();

    stationTimetable.sort((a, b) => a.actualDepTime - b.actualDepTime);

    const displayList = stationTimetable
        .filter(t => !t.isPassing && !t.notSpawnedExpired && isPassengerTrainType(t.trainTypeRaw))
        .slice(0, 10);

    if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #8899aa;">Brak zaplanowanych przejazdów przez stację.<br><br><span style="font-size: 0.8em; opacity: 0.6;">Aktualnie na całym serwerze znajduje się ${globalActiveTrainsCount} aktywnych pociągów.</span></td></tr>`;
        return;
    }

    displayList.forEach(t => {
        const tr = document.createElement('tr');

        let typeStr = 'Osobowy / Regionalny';
        if (isEijPendolino(t.trainTypeRaw, t.trainCategory, t.trainName)) typeStr = 'Intercity / Express Premium';
        else if (isEijRegionalLka(t.trainTypeRaw, t.trainCategory, t.trainName)) typeStr = 'Regionalny / Pośpieszny ŁKA';
        else if (t.trainCategory.includes('EIP') || t.trainName.includes('EIP')) typeStr = 'Dalekobieżny / Intercity';
        else if (t.trainCategory.includes('Łs') || t.trainName.includes('Łs')) typeStr = 'Pośpieszny / Osobowy';
        else if (t.trainCategory.includes('MPE')) typeStr = 'Dalekobieżny / TLK';
        else if (LONG_DISTANCE_EXPRESS_TYPES.has(t.trainTypeRaw)) typeStr = 'Dalekobieżny / Intercity';
        else if (t.trainCategory.includes('ŁKA')) typeStr = 'Regionalny / Sprinter';

        let timeHtml = '';
        let arrHtml = formatServerTimeStr(t.rawArrTime);
        let depHtml = formatServerTimeStr(t.rawDepTime);

        if (t.delayMin > 0) {
            if (t.rawArrTime) {
                arrHtml = `<span style="color: #999; text-decoration: line-through; font-size: 0.85em;">${arrHtml}</span> <span style="color: #ff4444; font-weight: bold;">${formatServerTimeStr(t.actualArrTime)}</span>`;
            }
            depHtml = `<span style="color: #999; text-decoration: line-through; font-size: 0.85em;">${depHtml}</span> <span style="color: #ff4444; font-weight: bold;">${formatServerTimeStr(t.actualDepTime)}</span>`;
        }

        if (t.rawArrTime && t.rawArrTime !== t.rawDepTime) {
            timeHtml = `<div style="line-height: 1.3; font-size: 0.9em;">
                <div style="color: #ccc;"><small style="opacity:0.7">Przyj: </small>${arrHtml}</div>
                <div style="color: #fff;"><small style="opacity:0.7">Odj: </small>${depHtml}</div>
            </div>`;
        } else {
            timeHtml = `<div style="line-height: 1.3; font-size: 0.9em;"><small style="opacity:0.7">Odj: </small>${depHtml}</div>`;
        }

        let statusHtml = '';

        if (t.cancelled) {
            statusHtml = '<span style="color:#ff4444;">Odwołany</span>';
        } else if (!t.seenOnMap) {
            statusHtml = '<span style="color:#aaccff;">Zaplanowany</span>';
        } else if (t.gpsStatus === 'Odjechał' || (t.gpsStatus !== 'Na stacji' && now > t.actualDepTime + STATION_DEPARTURE_FALLBACK_MS)) {
            statusHtml = '<span style="color:#aaccff;">Odjechał</span>';
        } else if (t.gpsStatus === 'Na stacji') {
            statusHtml = '<span style="color:#00e676;">Na stacji</span>';
        } else if (t.delayMin > 0) {
            statusHtml = `<span style="color:#ff4444;">Opóźniony ${t.delayMin} min</span>`;
        } else {
            statusHtml = '<span style="color:#ffcc00;">Na czas</span>';
        }

        const platformDisplay = t.platform || '—';
        const trackDisplay = t.track || '—';

        tr.innerHTML = `
            <td>${timeHtml}</td>
            <td><div class="plk-train-name">${t.trainName}</div><span class="plk-train-type">${typeStr}</span></td>
            <td><div class="plk-dest">${t.destination}</div>${t.viaText ? `<span class="plk-via">przez: ${t.viaText}</span>` : ''}</td>
            <td style="text-align: center; font-weight: bold; font-size: 28px; color: #ffcc00;">${platformDisplay}</td>
            <td style="text-align: center; font-weight: bold; font-size: 28px; color: #ffcc00;">${trackDisplay}</td>
            <td style="text-align: right; font-weight: bold; font-size: 24px;">${statusHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function startStationLiveTracking() {
    if (trackingInterval) clearInterval(trackingInterval);
    const stationVoice = 'pl-PL-ZofiaNeural';

    trackingInterval = setInterval(async () => {
        refreshCountdown = 15;

        try {
            const now = getSimNow();
            const activeTrains = await fetchJsonFresh(
                `${API_BASE}/sit-journeys/v2/active?serverId=${currentServerId}`,
                'Live tracking - stacja'
            );

            syncTimeWithActiveTrains(activeTrains);
            globalActiveTrainsCount = Array.isArray(activeTrains) ? activeTrains.length : 0;

            // Poczekaj na dodanie nowych pociągów, żeby mogły zostać uwzględnione
            // jeszcze w tym samym cyklu odświeżenia.
            await syncNewTrains(activeTrains);

            // ETAP 1: aktualizacja danych wszystkich pociągów.
            for (const t of stationTimetable) {
                const trainActive = Array.isArray(activeTrains)
                    ? activeTrains.find(act => act.journeyId === t.journeyId)
                    : null;

                t.currentDist = Infinity;

                if (trainActive) {
                    // Sam fakt obecności journeyId na liście aktywnych oznacza, że pociąg nadal istnieje.
                    // Chwilowy brak liveData nie może zostać potraktowany jak odwołanie.
                    if (t.cancelled) removeTrainFromCancelledHistory(t);
                    t.seenOnMap = true;
                    t.notSpawnedExpired = false;
                    t.missingCount = 0;
                    t.cancelled = false;
                    t.cancelledTime = 0;

                    if (trainActive.liveData) {
                        // UWAGA: nie nadpisujemy tutaj opóźnienia wartością liveData.delay.
                        // To jest opóźnienie bieżącej pozycji pociągu, a nie opóźnienie
                        // dla wybranej stacji. Czasy stacyjne odświeżamy osobno z by-id.

                        if (t.stLat && t.stLon && trainActive.liveData.position) {
                            t.currentDist = getDistanceFromLatLonInMeters(
                                trainActive.liveData.position.latitude,
                                trainActive.liveData.position.longitude,
                                t.stLat,
                                t.stLon
                            );

                            if (t.currentDist <= STATION_GPS_AT_PLATFORM_METERS) {
                                t.gpsStatus = 'Na stacji';
                            } else if (t.currentDist > STATION_GPS_AT_PLATFORM_METERS && t.gpsStatus === 'Na stacji') {
                                t.gpsStatus = 'Odjechał';
                                if (t.departedAt === 0) t.departedAt = now;
                            }
                        }
                    }
                } else if (!t.seenOnMap) {
                    // Rekord z pełnego rozkładu jest widoczny tylko do chwili, w której
                    // pociąg powinien pojawić się na mapie. Nigdy niewidzianego składu
                    // nie oznaczamy jako odwołanego i nie zapisujemy w historii.
                    if (t.scheduledStartTime && now >= t.scheduledStartTime) {
                        t.notSpawnedExpired = true;
                    }
                } else {
                    t.missingCount = (t.missingCount || 0) + 1;

                    // Jednorazowy brak pociągu w odpowiedzi API nie może oznaczać odwołania.
                    if (
                        t.missingCount >= STATION_MISSING_LIMIT &&
                        !t.isPassing &&
                        !t.cancelled &&
                        !t.departedAdded &&
                        t.gpsStatus !== 'Odjechał'
                    ) {
                        t.cancelled = true;
                        t.cancelledTime = now;
                        addTrainToCancelledHistory(t, now);
                        console.warn(`[STACJA] ${t.trainName} uznany za odwołany po ${t.missingCount} kolejnych brakach w API.`);
                    }
                }
            }

            // Na tablicy i w zwykłych zapowiedziach pozostają wyłącznie składy
            // pasażerskie. Rekordy przejazdów bez zatrzymania zachowujemy w pamięci
            // tylko do jednorazowego komunikatu ostrzegawczego.
            stationTimetable = stationTimetable.filter(t =>
                (isPassengerTrainType(t.trainTypeRaw) || t.isPassing) &&
                !t.technicalStopOnly &&
                !t.notSpawnedExpired
            );

            // Aktualizujemy szczegółowe czasy tylko dla maks. 10 najbliższych pociągów.
            // Dzięki temu tablica korzysta z opóźnienia dla WYBRANEJ STACJI, tak jak
            // widok stacyjny SimRail, bez zasypywania API zapytaniami o cały serwer.
            const stationRealtimeCandidates = [...stationTimetable]
                .filter(t => t.seenOnMap && !t.isPassing && !t.cancelled && t.gpsStatus !== 'Odjechał')
                .sort((a, b) => a.actualDepTime - b.actualDepTime)
                .slice(0, 10);

            await Promise.all(stationRealtimeCandidates.map(t => refreshStationSpecificRealtime(t)));

            // Jeżeli świeże dane jednoznacznie wskazały postój techniczny,
            // usuwamy pociąg jeszcze przed wyliczeniem widocznych rekordów i zapowiedzi.
            stationTimetable = stationTimetable.filter(t => !t.technicalStopOnly);

            // Po aktualizacji opóźnień kolejność TOP 10 może się zmienić.
            const displayedJourneyIds = getDisplayedStationJourneyIds();

            // ETAP 2: zapowiedzi, statusy i przenoszenie do historii.
            for (const t of stationTimetable) {
                const isDisplayed = displayedJourneyIds.has(t.journeyId);
                let standardAnnouncementPlayedThisCycle = false;

                // Komunikaty o opóźnieniu dotyczą pociągów widocznych na tablicy
                // i są odtwarzane dopiero od 5 minut opóźnienia.
                if (isDisplayed && t.seenOnMap && !t.cancelled && !t.isPassing && t.gpsStatus !== 'Odjechał') {
                    const previousSpokenDelay = t.lastDelaySpoken;

                    if (
                        t.delayMin >= STATION_DELAY_ANNOUNCEMENT_MINUTES &&
                        previousSpokenDelay !== t.delayMin
                    ) {
                        playGongAndSpeak(buildStationDelayAnnouncement(t), stationVoice);
                        t.lastDelaySpoken = t.delayMin;
                        console.log(`[STACJA] Zapowiedź opóźnienia ${t.trainName}: +${t.delayMin} min.`);
                    } else if (
                        t.delayMin === 0 &&
                        typeof previousSpokenDelay === 'number' &&
                        previousSpokenDelay >= STATION_DELAY_ANNOUNCEMENT_MINUTES
                    ) {
                        // Zgodnie z założeniem: gdy opóźnienie znika, zamiast komunikatu
                        // „opóźnienie zlikwidowane” odtwarzamy zwykłą zapowiedź pociągu.
                        playGongAndSpeak(buildStationStandardAnnouncement(t), stationVoice);
                        t.lastDelaySpoken = 0;
                        standardAnnouncementPlayedThisCycle = true;
                        console.log(`[STACJA] ${t.trainName} wrócił do rozkładu – standardowa zapowiedź.`);
                    } else if (t.delayMin < STATION_DELAY_ANNOUNCEMENT_MINUTES) {
                        // Zmianę 1–4 min zapamiętujemy bez komunikatu. Dzięki temu
                        // przekroczenie progu 5 minut zostanie później wykryte prawidłowo.
                        t.lastDelaySpoken = t.delayMin;
                    }
                }

                const targetTime = t.rawArrTime ? t.actualArrTime : t.actualDepTime;
                const timeDiffMinutes = (targetTime - now) / 60000;

                let shouldAnnounceArrival = false;
                if (t.seenOnMap && !t.announced && !t.cancelled && t.gpsStatus === 'Oczekuje') {
                    if (Number.isFinite(t.currentDist)) {
                        // GPS ma pierwszeństwo przed zegarem. Nie blokujemy zapowiedzi tylko dlatego,
                        // że według rozkładu godzina przyjazdu już minęła.
                        if (t.currentDist <= STATION_ANNOUNCE_DISTANCE_METERS) {
                            shouldAnnounceArrival = true;
                        }
                    } else if (timeDiffMinutes <= 3 && timeDiffMinutes >= -1) {
                        // Awaryjnie, gdy brak GPS: zapowiedź w oknie 3 min przed do 1 min po czasie.
                        shouldAnnounceArrival = true;
                    }
                }

                if (shouldAnnounceArrival && !t.announced) {
                    t.announced = true;

                    // Jeżeli chwilę wcześniej standardowa zapowiedź została odtworzona dlatego,
                    // że opóźnienie spadło do zera, nie dublujemy jej w tym samym cyklu.
                    if (!standardAnnouncementPlayedThisCycle) {
                        if (t.isPassing) {
                            playGongAndSpeak(
                                'Uwaga. Przez stację przejedzie pociąg bez zatrzymania. Prosimy o zachowanie ostrożności oraz nie zbliżanie się do krawędzi peronu.',
                                stationVoice
                            );
                        } else {
                            let speech = buildStationStandardAnnouncement(t);
                            if (t.delayMin >= STATION_DELAY_ANNOUNCEMENT_MINUTES) {
                                // Zapowiedź przyjazdu opóźnionego pociągu pozostaje standardową
                                // zapowiedzią przyjazdu, ale od progu 5 minut jasno informuje,
                                // że pociąg jest opóźniony.
                                const { trainType, reservationSuffix, number, viaText } = getStationTrainSpeechInfo(t);
                                const time = formatServerTimeStr(t.actualArrTime);
                                const locationSpeech = buildStationLocationSpeech(t, false);
                                speech = `Opóźniony ${trainType} ${number} do stacji ${t.destination}${viaText}, przyjedzie o godzinie ${time}.${locationSpeech}${reservationSuffix} Prosimy zachować ostrożność i nie zbliżać się do krawędzi peronu.`;
                            }
                            playGongAndSpeak(speech, stationVoice);
                        }
                    }
                }

                const stopDuration = Math.max(0, t.actualDepTime - t.actualArrTime);
                const timeDiffDepMinutes = (t.actualDepTime - now) / 60000;

                if (t.seenOnMap && !t.cancelled && !t.isPassing && stopDuration > 3 * 60000) {
                    if (timeDiffDepMinutes <= 3 && timeDiffDepMinutes > 0 && !t.departureAnnounced) {
                        t.departureAnnounced = true;
                        const { trainType, number, viaText } = getStationTrainSpeechInfo(t);
                        const className = trainType.charAt(0).toUpperCase() + trainType.slice(1);
                        const formattedDep = formatServerTimeStr(t.actualDepTime);
                        const locationSpeech = buildStationLocationSpeech(t, true);
                        playGongAndSpeak(`${className}, ${number} do stacji ${t.destination}${viaText}, odjedzie o godzinie ${formattedDep}.${locationSpeech}`, stationVoice);
                    }
                }

                let isPhysicallyDeparted = false;
                if (t.seenOnMap && t.gpsStatus === 'Odjechał') {
                    isPhysicallyDeparted = true;
                } else if (t.seenOnMap && now > t.actualDepTime + STATION_DEPARTURE_FALLBACK_MS && t.gpsStatus !== 'Na stacji') {
                    // Fallback czasowy tylko z marginesem 3 min, a nie natychmiast po godzinie odjazdu.
                    isPhysicallyDeparted = true;
                }

                if (isPhysicallyDeparted && !t.departedAdded && !t.cancelled) {
                    if (t.departedAt === 0) t.departedAt = now;
                    // Przejazd bez zatrzymania nie jest odjazdem pasażerskim i nie
                    // powinien pojawiać się w oknie „Pociągi odjechane”.
                    if (!t.isPassing) departedHistory.push({ ...t, departedAt: t.departedAt });
                    t.departedAdded = true;
                }
            }

            stationTimetable = stationTimetable.filter(t => {
                if (t.cancelled) {
                    const keepOnBoard = now <= t.cancelledTime + 2 * 60000;
                    if (!keepOnBoard && t.journeyId) knownJourneyIds.delete(t.journeyId);
                    return keepOnBoard;
                }
                if (t.departedAdded) return now <= t.departedAt + 60000;
                return true;
            });

            if (!isSyncing) renderStationBoard();

            if (document.getElementById('departed-modal').style.display === 'flex') {
                renderDepartedModal();
            }
            if (document.getElementById('cancelled-modal').style.display === 'flex') {
                renderCancelledModal();
            }
        } catch (err) {
            console.error('[STACJA] Błąd śledzenia tablicy stacyjnej:', err);
            if (err?.code === 'STALE_API_DATA' || err?.code === 'API_TIMEOUT' || err?.code === 'API_HTTP_ERROR') {
                const tbody = document.getElementById('station-departures-body');
                if (tbody) {
                    const text = err?.code === 'STALE_API_DATA'
                        ? 'Dane API są nieaktualne. Wstrzymano odświeżanie tablicy, aby nie pokazywać starego rozkładu.'
                        : 'Brak aktualnego połączenia z API. Oczekiwanie na ponowne połączenie...';
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:#ff5252;">${text}</td></tr>`;
                }
            }
        }
    }, STATION_REFRESH_MS);
}

// ==========================================
// 5. TRYB POKŁADOWY (MASZYNISTA)
// ==========================================
async function loadTrainsForOnboard(serverCode) {
    try {
        const sData = serversMap[serverCode];
        currentServerId = sData.id;
        activeServerPcToServerDelta = sData.pcToServerDelta;
        
        if (!currentServerId) return;

        trainSearch.value = '';
        trainSearch.placeholder = 'Pobieranie pociągów...';
        trainSearch.disabled = true;
        trainTypeFilter.disabled = true;
        trainSelect.innerHTML = '<option value="">Pobieranie...</option>';
        trainSelect.disabled = true;
        refreshTrainsBtn.disabled = true;
        allPassengerTrains = [];
        
        if (appMode === 'onboard') startBtn.disabled = true;

        const trains = await fetchJsonFresh(
            `${API_BASE}/sit-journeys/v2/active?serverId=${currentServerId}`,
            'Lista pociągów'
        );
        
        syncTimeWithActiveTrains(trains);

        if (!trains || trains.length === 0) {
            trainSearch.placeholder = 'Brak pociągów na serwerze';
            trainSelect.innerHTML = '<option value="">Brak pociągów</option>';
            refreshTrainsBtn.disabled = false;
            return;
        }

        const passengerTrains = trains.filter(isPassengerActiveTrain);

        if (passengerTrains.length === 0) {
            trainSearch.placeholder = 'Brak pociągów pasażerskich';
            trainSelect.innerHTML = '<option value="">Brak pociągów</option>';
            refreshTrainsBtn.disabled = false;
            return;
        }

        passengerTrains.forEach(t => {
            const category = t.originEvent?.transport?.category || 'POC';
            const number = t.originEvent?.transport?.number || '0';
            const destination = t.destinationEvent?.stopPlace?.name || '?';
            
            allPassengerTrains.push({
                journeyId: t.journeyId,
                label: `${category} ${number} (Kierunek: ${destination})`,
                trainInfo: `${category} ${number}`,
                destination: destination,
                type: t.originEvent?.transport?.type,
                rawNumber: number 
            });
        });

        allPassengerTrains.sort((a, b) => {
            const numA = parseInt(a.rawNumber.toString().replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(b.rawNumber.toString().replace(/\D/g, ''), 10) || 0;
            if (numA === numB) return a.label.localeCompare(b.label);
            return numA - numB;
        });

        trainSearch.disabled = false;
        trainTypeFilter.disabled = false;
        trainSelect.disabled = false;
        refreshTrainsBtn.disabled = false;
        trainSearch.placeholder = 'Wpisz numer by przefiltrować...';
        
        renderTrainOptions(); 
    } catch (err) {
        console.error('[MASZYNISTA] Błąd pobierania listy pociągów:', err);
        trainSearch.placeholder = err?.code === 'STALE_API_DATA' ? 'API zwraca nieaktualne dane' : 'Błąd API';
        trainSelect.innerHTML = `<option value="">${err?.code === 'STALE_API_DATA' ? 'Nieaktualne dane API' : 'Brak połączenia z API'}</option>`;
        trainSelect.disabled = true;
        trainTypeFilter.disabled = true;
        startBtn.disabled = true;
        refreshTrainsBtn.disabled = false;
    }
}
refreshTrainsBtn.addEventListener('click', () => { if (serverSelect.value) loadTrainsForOnboard(serverSelect.value); });
trainTypeFilter.addEventListener('change', () => { renderTrainOptions(trainSearch.value); checkStartCondition(); });
trainSearch.addEventListener('input', () => { renderTrainOptions(trainSearch.value); checkStartCondition(); });

function renderTrainOptions(filterText = '') {
    trainSelect.innerHTML = '';
    const lowerFilter = filterText.toLowerCase();
    const typeFilter = trainTypeFilter.value; 

    const filteredTrains = allPassengerTrains.filter(t => {
        if (!t.label.toLowerCase().includes(lowerFilter)) return false;
        const info = t.trainInfo.toUpperCase();
        
        const isExpress = isExpressTrainForUi(t.type, info);

        if (typeFilter === 'EXPRESS' && !isExpress) return false;
        if (typeFilter === 'REGIONAL' && isExpress) return false;
        return true;
    });

    if (filteredTrains.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "Brak pociągów spełniających kryteria";
        opt.disabled = true;
        trainSelect.appendChild(opt);
    } else {
        filteredTrains.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.journeyId;
            opt.textContent = t.label;
            opt.dataset.trainInfo = t.trainInfo;
            opt.dataset.destination = t.destination;
            opt.dataset.type = t.type;
            opt.dataset.rawNumber = t.rawNumber;
            trainSelect.appendChild(opt);
        });
    }
}

function updateSpeedOnboard(newSpeed) {
    const speedElement = document.querySelector('.speed-value');
    if (speedElement) speedElement.textContent = Math.round(newSpeed);
}
function updateMainStationNameOnboard(name) {
    const container = document.querySelector('.next-station-container');
    const element = document.querySelector('.next-station');
    if (element.textContent !== name && element.textContent !== '...') {
        element.style.animation = 'none';
        element.classList.add('fade-out');
        setTimeout(() => {
            element.textContent = name;
            element.classList.remove('fade-out');
            setTimeout(() => {
                const overflow = element.scrollWidth - container.clientWidth;
                if (overflow > 0) {
                    element.style.setProperty('--scroll-dist', `-${overflow + 20}px`);
                    element.style.animation = `scroll-station ${(overflow / 50) + 2}s linear infinite alternate`;
                }
            }, 50);
        }, 500);
    } else if (element.textContent === '...') {
        element.textContent = name;
        setTimeout(() => {
            const overflow = element.scrollWidth - container.clientWidth;
            if (overflow > 0) {
                element.style.setProperty('--scroll-dist', `-${overflow + 20}px`);
                element.style.animation = `scroll-station ${(overflow / 50) + 2}s linear infinite alternate`;
            }
        }, 50);
    }
}
function adjustRouteFontsOnboard() {
    setTimeout(() => {
        document.querySelectorAll('.route-station').forEach(el => {
            let size = 28; 
            if (el.parentElement.classList.contains('approaching') || el.parentElement.classList.contains('at-station')) size = 36;
            el.style.fontSize = size + 'px';
            while (el.scrollWidth > el.clientWidth && size > 12) { size -= 1; el.style.fontSize = size + 'px'; }
        });
    }, 50);
}

function getOnboardStopDelayMinutes(stop) {
    const preferredDelay = stop.state === 'at-station'
        ? (stop.departureDelayMin ?? stop.arrivalDelayMin)
        : (stop.arrivalDelayMin ?? stop.departureDelayMin);

    return normalizeDelayMinutes(preferredDelay ?? stop.delayMin);
}

function renderRouteUIOnboard(routeArray) {
    const routeListContainer = document.querySelector('.route-list ul');
    const mainTime = document.querySelector('.eta .time');
    routeListContainer.innerHTML = ''; 
    routeArray.forEach(stop => {
        const li = document.createElement('li');
        if (stop.state === 'approaching') li.classList.add('approaching');
        else if (stop.state === 'at-station') li.classList.add('at-station');

        let arrTime = stop.arrivalTime || stop.time;
        let depTime = stop.departureTime || stop.time;
        let timeDisplay = arrTime;
        if (arrTime && depTime && arrTime !== depTime && arrTime !== '--:--' && depTime !== '--:--') timeDisplay = `${arrTime} / ${depTime}`;

        let timeHtml = `<span class="route-time">${timeDisplay}</span><div class="route-dot"></div><span class="route-station">${stop.station}</span>`;
        li.innerHTML = timeHtml;
        routeListContainer.appendChild(li);

        if (stop.state === 'approaching' || stop.state === 'at-station') {
            updateMainStationNameOnboard(stop.station); 
            const delayMinutes = getOnboardStopDelayMinutes(stop);
            const delayStr = delayMinutes > 0 ? ` <span style="color:#ff4444">(+${delayMinutes} min)</span>` : '';
            mainTime.innerHTML = `${stop.state === 'at-station' ? (stop.departureTime || stop.time) : (stop.arrivalTime || stop.time)}${delayStr}`;
        }
    });
    adjustRouteFontsOnboard();
}

const ONBOARD_NEXT_STATION_DISTANCE_LONG_DISTANCE_METERS = 500;
const ONBOARD_NEXT_STATION_DISTANCE_REGIONAL_METERS = 200;

function getOnboardNextStationAnnouncementDistanceMeters() {
    return activeTrainType === 'REGIONAL_TRAIN'
        ? ONBOARD_NEXT_STATION_DISTANCE_REGIONAL_METERS
        : ONBOARD_NEXT_STATION_DISTANCE_LONG_DISTANCE_METERS;
}

function normalizeOnboardTimetableText(value) {
    return String(value || '')
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function getFullTimetableFirstTime(train) {
    const firstTimedPoint = (train?.timetable || []).find(row => row?.departureTime || row?.arrivalTime);
    return toTimestamp(firstTimedPoint?.departureTime || firstTimedPoint?.arrivalTime);
}

function findFullTimetableForOnboardJourney(fullTimetable, journeyData, selectedTrainNumber = '') {
    if (!Array.isArray(fullTimetable) || !Array.isArray(journeyData?.events)) return null;

    const stopEvents = journeyData.events.filter(ev => ev?.stopPlace?.name);
    if (stopEvents.length === 0) return null;

    const journeyTrainNumber = String(
        selectedTrainNumber ||
        stopEvents.find(ev => ev?.transport?.number)?.transport?.number ||
        ''
    ).trim();

    if (!journeyTrainNumber) return null;

    const originName = normalizeOnboardTimetableText(stopEvents[0].stopPlace.name);
    const destinationName = normalizeOnboardTimetableText(stopEvents[stopEvents.length - 1].stopPlace.name);
    const firstJourneyTime = toTimestamp(
        stopEvents.find(ev => ev?.scheduledTime)?.scheduledTime
    );

    let candidates = fullTimetable.filter(train => {
        if (String(train?.trainNoLocal || '').trim() === journeyTrainNumber) return true;

        return (train?.timetable || []).some(row =>
            String(row?.displayedTrainNumber || '').trim() === journeyTrainNumber
        );
    });

    if (candidates.length === 0) return null;

    const exactRouteCandidates = candidates.filter(train =>
        normalizeOnboardTimetableText(train?.startStation) === originName &&
        normalizeOnboardTimetableText(train?.endStation) === destinationName
    );

    if (exactRouteCandidates.length > 0) candidates = exactRouteCandidates;

    candidates.sort((a, b) => {
        const aStart = getFullTimetableFirstTime(a);
        const bStart = getFullTimetableFirstTime(b);
        const aGap = firstJourneyTime !== null && aStart !== null
            ? Math.abs(aStart - firstJourneyTime)
            : Number.MAX_SAFE_INTEGER;
        const bGap = firstJourneyTime !== null && bStart !== null
            ? Math.abs(bStart - firstJourneyTime)
            : Number.MAX_SAFE_INTEGER;

        return aGap - bGap;
    });

    return candidates[0] || null;
}

function buildFullTimetableStopMap(train) {
    const stops = new Map();

    for (const row of train?.timetable || []) {
        const names = [row?.nameOfPoint, row?.nameForPerson]
            .map(normalizeOnboardTimetableText)
            .filter(Boolean);

        names.forEach(name => {
            if (!stops.has(name)) stops.set(name, row);
        });
    }

    return stops;
}

function getOnboardPlannedEventTime(event, fullTimetableStop) {
    const fullTimetableTime = event?.type === 'ARRIVAL'
        ? fullTimetableStop?.arrivalTime
        : fullTimetableStop?.departureTime;

    return fullTimetableTime || event?.scheduledTime || event?.realtimeTime || null;
}

function getOnboardEventDelayMinutes(event, plannedTime) {
    const realtimeMs = toTimestamp(event?.realtimeTime);
    const plannedMs = toTimestamp(plannedTime || event?.scheduledTime);

    if (realtimeMs === null || plannedMs === null) return 0;

    const delay = Math.round((realtimeMs - plannedMs) / 60000);
    return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

async function startOnboardMode() {
    activeJourneyId = trainSelect.value;
    const selectedOption = trainSelect.options[trainSelect.selectedIndex];
    
    activeDestination = selectedOption.dataset.destination;
    
    const trainInfoText = selectedOption.dataset.trainInfo.toUpperCase();
    if (isExpressTrainForUi(selectedOption.dataset.type, trainInfoText)) {
        activeTrainType = "NATIONAL_EXPRESS_TRAIN";
    } else {
        activeTrainType = "REGIONAL_TRAIN";
    }

    setupScreen.style.display = 'none';
    sipScreen.style.display = 'flex';
    document.querySelector('.train-info').textContent = `${selectedOption.dataset.trainInfo} • Kierunek: ${activeDestination}`;
    document.querySelector('.current-status .label').textContent = 'NASTĘPNA STACJA:';
    document.querySelector('.eta-box .label').textContent = 'PLANOWY PRZYJAZD:';

    let initialLat = 0, initialLon = 0;
    try {
        const trains = await fetchJsonFresh(
            `${API_BASE}/sit-journeys/v2/active?serverId=${currentServerId}`,
            'Lista pociągów'
        );
        
        syncTimeWithActiveTrains(trains);
        
        const myTrain = trains.find(t => t.journeyId === activeJourneyId);
        if (myTrain && myTrain.liveData) {
            initialLat = myTrain.liveData.position.latitude;
            initialLon = myTrain.liveData.position.longitude;
        }
    } catch (err) {
        console.error('[MASZYNISTA] Błąd pobrania początkowej pozycji pociągu:', err);
    }

    await loadJourneyRouteOnboard(
        activeJourneyId,
        initialLat,
        initialLon,
        selectedOption.dataset.rawNumber || ''
    );
    startOnboardLiveTracking();
}

async function loadJourneyRouteOnboard(journeyId, trainLat, trainLon, selectedTrainNumber = '') {
    try {
        const [journeyData, fullTimetable] = await Promise.all([
            fetchJsonFresh(
                `${API_BASE}/sit-journeys/v2/by-id/${journeyId}`,
                'Trasa pociągu - start'
            ),
            fetchFullServerTimetable(activeServerCode).catch(err => {
                console.warn('[MASZYNISTA] Pełna rozkładówka jest chwilowo niedostępna. Używam planu z aktywnego pociągu:', err);
                return null;
            })
        ]);

        const matchedFullTimetable = findFullTimetableForOnboardJourney(
            fullTimetable,
            journeyData,
            selectedTrainNumber
        );
        const fullTimetableStops = buildFullTimetableStopMap(matchedFullTimetable);

        if (matchedFullTimetable) {
            console.log(`[MASZYNISTA] Godziny planowe pobrano z pełnej rozkładówki: ${matchedFullTimetable.trainNoLocal || selectedTrainNumber}.`);
        } else {
            console.warn('[MASZYNISTA] Nie dopasowano pełnej rozkładówki. Używam scheduledTime z aktywnego pociągu.');
        }

        const stationsMap = new Map();
        
        if (journeyData.events && journeyData.events.length > 0) {
            journeyData.events.forEach((ev) => {
                if (ev.stopPlace && ev.stopPlace.name && isCommercialStationStopEvent(ev)) {
                    const name = ev.stopPlace.name;
                    if (!stationsMap.has(name)) {
                        stationsMap.set(name, {
                            station: name,
                            lat: ev.stopPlace.position.latitude,
                            lon: ev.stopPlace.position.longitude,
                            arrivalTime: null,
                            departureTime: null,
                            plannedArrivalRawTime: null,
                            plannedDepartureRawTime: null,
                            realtimeArrivalRawTime: null,
                            realtimeDepartureRawTime: null,
                            arrivalDelayMin: null,
                            departureDelayMin: null,
                            delayMin: 0
                        });
                    }
                    const st = stationsMap.get(name);
                    const fullTimetableStop = fullTimetableStops.get(
                        normalizeOnboardTimetableText(name)
                    );
                    const plannedTime = getOnboardPlannedEventTime(ev, fullTimetableStop);
                    const delay = getOnboardEventDelayMinutes(ev, plannedTime);
                    const realtimeTime = ev.realtimeTime || plannedTime;

                    if (ev.type === "ARRIVAL") {
                        st.arrivalTime = formatServerTimeStr(plannedTime);
                        st.plannedArrivalRawTime = toTimestamp(plannedTime);
                        st.realtimeArrivalRawTime = toTimestamp(realtimeTime);
                        st.rawTime = st.realtimeArrivalRawTime || st.plannedArrivalRawTime;
                        st.arrivalDelayMin = delay;
                    } else if (ev.type === "DEPARTURE") {
                        st.departureTime = formatServerTimeStr(plannedTime);
                        st.plannedDepartureRawTime = toTimestamp(plannedTime);
                        st.realtimeDepartureRawTime = toTimestamp(realtimeTime);
                        if (!st.rawTime) {
                            st.rawTime = st.realtimeDepartureRawTime || st.plannedDepartureRawTime;
                        }
                        st.departureDelayMin = delay;
                    }
                }
            });
            
            targetStationList = Array.from(stationsMap.values()).map(st => ({
                station: st.station,
                time: st.arrivalTime || st.departureTime,
                arrivalTime: st.arrivalTime,
                departureTime: st.departureTime,
                plannedArrivalRawTime: st.plannedArrivalRawTime,
                plannedDepartureRawTime: st.plannedDepartureRawTime,
                realtimeArrivalRawTime: st.realtimeArrivalRawTime,
                realtimeDepartureRawTime: st.realtimeDepartureRawTime,
                arrivalDelayMin: st.arrivalDelayMin,
                departureDelayMin: st.departureDelayMin,
                rawTime: st.rawTime,
                lat: st.lat,
                lon: st.lon,
                delayMin: st.arrivalDelayMin ?? st.departureDelayMin ?? 0,
                current: false,
                arrivalPlayed: false,
                departureAnnounced: false,
                warsAnnounced: false,
                minDistance: Infinity,
                state: 'inactive'
            }));

            if (targetStationList.length > 0) {
                let activeIdx = 0;
                if (trainLat !== 0 && trainLon !== 0) {
                    let minDistance = Infinity;
                    let closestIndex = 0;
                    targetStationList.forEach((station, index) => {
                        const dist = getDistanceFromLatLonInMeters(trainLat, trainLon, station.lat, station.lon);
                        if (dist < minDistance) { minDistance = dist; closestIndex = index; }
                    });
                    if (minDistance < 3000) activeIdx = closestIndex;
                    else {
                        const now = getSimNow(); 
                        if (now > targetStationList[closestIndex].rawTime && closestIndex + 1 < targetStationList.length) activeIdx = closestIndex + 1;
                        else activeIdx = closestIndex;
                    }
                    if (activeIdx > 0) {
                        const distFromPrev = getDistanceFromLatLonInMeters(trainLat, trainLon, targetStationList[activeIdx-1].lat, targetStationList[activeIdx-1].lon);
                        const nextStationAnnouncementDistance = getOnboardNextStationAnnouncementDistanceMeters();
                        if (distFromPrev >= nextStationAnnouncementDistance) targetStationList[activeIdx].departureAnnounced = true;
                        if (distFromPrev >= 2000) targetStationList[activeIdx].warsAnnounced = true;
                    }
                }
                targetStationList[activeIdx].current = true;
                targetStationList[activeIdx].state = 'approaching';
                for(let i = 0; i < activeIdx; i++) { targetStationList[i].arrivalPlayed = true; targetStationList[i].state = 'inactive'; }
            }
        }
        
        renderRouteUIOnboard(targetStationList);
        setTimeout(() => {
            const activeElement = document.querySelector('.route-list li.approaching') || document.querySelector('.route-list li.at-station');
            if (activeElement) activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
    } catch(err) {
        console.error('[MASZYNISTA] Błąd wczytywania trasy pociągu:', err);
    }
}

function startOnboardLiveTracking() {
    if (trackingInterval) clearInterval(trackingInterval);
    const currentIsIntercity = ["NATIONAL_EXPRESS_TRAIN", "INTER_NATIONAL_EXPRESS_TRAIN", "INTER_REGIONAL_EXPRESS_TRAIN"].includes(activeTrainType);
    const currentHasWars = ["NATIONAL_EXPRESS_TRAIN", "INTER_NATIONAL_EXPRESS_TRAIN"].includes(activeTrainType);
    const assignedVoice = currentIsIntercity ? 'pl-PL-ZofiaNeural' : 'pl-PL-MarekNeural';
    let missingTrainCount = 0;
    let trackingLoopCounter = 0;

    trackingInterval = setInterval(async () => {
        trackingLoopCounter++;
        try {
            const trains = await fetchJsonFresh(
                `${API_BASE}/sit-journeys/v2/active?serverId=${currentServerId}`,
                'Live tracking - maszynista'
            );
            
            syncTimeWithActiveTrains(trains);
            
            const myTrain = trains.find(t => t.journeyId === activeJourneyId);
            
            if (!myTrain || !myTrain.liveData) {
                missingTrainCount++;
                if (missingTrainCount >= 4) document.querySelector('.back-btn').click();
                return;
            } else missingTrainCount = 0;

            if (trackingLoopCounter % 6 === 0) {
                try {
                    const journeyData = await fetchJsonFresh(
                        `${API_BASE}/sit-journeys/v2/by-id/${activeJourneyId}`,
                        'Odświeżenie rozkładu - maszynista'
                    );
                    if (journeyData.events) {
                        journeyData.events.forEach(ev => {
                            if (ev.stopPlace && ev.stopPlace.name && isCommercialStationStopEvent(ev)) {
                                const st = targetStationList.find(s => s.station === ev.stopPlace.name);
                                if (st) {
                                    if (ev.type === "ARRIVAL") {
                                        const plannedTime = st.plannedArrivalRawTime ?? ev.scheduledTime;
                                        st.realtimeArrivalRawTime = toTimestamp(ev.realtimeTime || plannedTime);
                                        st.arrivalDelayMin = getOnboardEventDelayMinutes(ev, plannedTime);
                                    }

                                    if (ev.type === "DEPARTURE") {
                                        const plannedTime = st.plannedDepartureRawTime ?? ev.scheduledTime;
                                        st.realtimeDepartureRawTime = toTimestamp(ev.realtimeTime || plannedTime);
                                        st.departureDelayMin = getOnboardEventDelayMinutes(ev, plannedTime);
                                    }

                                    st.delayMin = getOnboardStopDelayMinutes(st);
                                    st.time = st.arrivalTime || st.departureTime;
                                }
                            }
                        });
                        renderRouteUIOnboard(targetStationList);
                    }
                } catch(e) {
                    console.error('[MASZYNISTA] Błąd okresowego odświeżania rozkładu:', e);
                }
            }

            updateSpeedOnboard(myTrain.liveData.speed);
            const currentLat = myTrain.liveData.position.latitude;
            const currentLon = myTrain.liveData.position.longitude;
            const targetStationIndex = targetStationList.findIndex(s => s.current);
            if (targetStationIndex === -1) return;
            
            const targetStation = targetStationList[targetStationIndex];
            const distMeters = getDistanceFromLatLonInMeters(currentLat, currentLon, targetStation.lat, targetStation.lon);

            if (distMeters < targetStation.minDistance) targetStation.minDistance = distMeters;

            if (targetStationIndex > 0) {
                const prevStation = targetStationList[targetStationIndex - 1];
                const distFromPrev = getDistanceFromLatLonInMeters(currentLat, currentLon, prevStation.lat, prevStation.lon);
                const nextStationAnnouncementDistance = getOnboardNextStationAnnouncementDistanceMeters();
                if (distFromPrev >= nextStationAnnouncementDistance && !targetStation.departureAnnounced && !targetStation.arrivalPlayed) {
                    targetStation.departureAnnounced = true;
                    const nextMsg = currentIsIntercity ? `Witamy Państwa na pokładzie pociągu intercity do stacji ${activeDestination}. Następna stacja ${targetStation.station}.` : `Następna stacja. ${targetStation.station}. Stacja docelowa. ${activeDestination}.`;
                    speakText(nextMsg, assignedVoice);
                }
                if (currentHasWars && distFromPrev >= 2000 && !targetStation.warsAnnounced && !targetStation.arrivalPlayed) {
                    targetStation.warsAnnounced = true;
                    speakText(`Szanowni Państwo. Zapraszamy do skorzystania ze strefy gastronomicznej wars, która znajduje się w wagonie numer trzy. Udając się do strefy wars prosimy pamiętać o zabraniu biletu oraz dokumentu tożsamości. Dziękujemy.`, assignedVoice);
                }
            }

            if (distMeters <= 700 && !targetStation.arrivalPlayed) {
                targetStation.arrivalPlayed = true;
                targetStation.state = 'at-station';
                document.querySelector('.current-status .label').textContent = 'STACJA:';
                document.querySelector('.eta-box .label').textContent = 'PLANOWY ODJAZD:';
                renderRouteUIOnboard(targetStationList);
                const msg = currentIsIntercity ? `Szanowni państwo zbliżamy się do stacji ${targetStation.station}. Osoby wysiadające prosimy o zabranie bagażu oraz rzeczy osobistych. Dziękujemy za wspólną podróż i życzymy miłego pobytu.` : `Stacja. ${targetStation.station}.`;
                speakText(msg, assignedVoice);
            }
            
            if (distMeters > 150 && targetStation.arrivalPlayed && distMeters > targetStation.minDistance + 100) {
                if(targetStationIndex + 1 < targetStationList.length) {
                    const nextStation = targetStationList[targetStationIndex + 1];
                    targetStation.current = false;
                    nextStation.current = true;
                    targetStation.state = 'inactive';
                    nextStation.state = 'approaching';
                    document.querySelector('.current-status .label').textContent = 'NASTĘPNA STACJA:';
                    document.querySelector('.eta-box .label').textContent = 'PLANOWY PRZYJAZD:';
                    renderRouteUIOnboard(targetStationList);
                    const activeElement = document.querySelector('.route-list li.approaching');
                    if (activeElement) activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        } catch (err) {
            console.error('[MASZYNISTA] Błąd pętli live tracking:', err);
        }
    }, 5000); 
}

// Inicjalizacja ładowania serwerów na starcie
loadServers();
