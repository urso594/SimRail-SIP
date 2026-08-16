const { ipcRenderer } = require('electron');

const APP_BUILD_TAG = 'station-fix-2026-08-16-02';
console.log(`[SimRail SIP] Build: ${APP_BUILD_TAG}`);

// ==========================================
// 1. ZEGAR, GŁOŚNOŚĆ I WSPÓLNY INTERFEJS
// ==========================================
let currentServerId = '';
let activeServerUtcOffset = 0; 
let activeServerPcToServerDelta = 0; 
let currentTtsVolume = 1.0;
let appMode = 'onboard';

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

function getSimNow() {
    return new Date().getTime() + activeServerPcToServerDelta;
}

function formatServerTimeStr(dateMs) {
    if(!dateMs) return '--:--';
    
    // NAPRAWA: Zmuszamy wartość do bycia liczbą, aby uniknąć NaN i sklejania stringów
    let localServerMs = new Date(dateMs).getTime();
    if (isNaN(localServerMs)) return '--:--';

    if (currentServerId) {
        localServerMs += (activeServerUtcOffset * 3600000);
    } else {
        localServerMs += (new Date().getTimezoneOffset() * -60000);
    }
    const serverTime = new Date(localServerMs);
    return `${String(serverTime.getUTCHours()).padStart(2, '0')}:${String(serverTime.getUTCMinutes()).padStart(2, '0')}`;
}

function updateClock() {
    let nowUtcMs = getSimNow();
    let localServerMs = nowUtcMs;
    if (currentServerId) {
        localServerMs += (activeServerUtcOffset * 3600000);
    } else {
        localServerMs += (new Date().getTimezoneOffset() * -60000);
    }
    const serverTime = new Date(localServerMs);
    const hours = String(serverTime.getUTCHours()).padStart(2, '0');
    const minutes = String(serverTime.getUTCMinutes()).padStart(2, '0');
    
    document.querySelectorAll('.clock').forEach(clockElement => {
        clockElement.innerHTML = `${hours}<span class="blink">:</span>${minutes}`;
    });
}
updateClock();
setInterval(updateClock, 1000);

function syncTimeWithActiveTrains(activeTrains) {
    if (!activeTrains || activeTrains.length === 0) return;
    
    let maxOrigin = 0;
    activeTrains.forEach(t => {
        if (t.originEvent && t.originEvent.scheduledTime) {
            let ms = new Date(t.originEvent.scheduledTime).getTime();
            if (ms > maxOrigin) maxOrigin = ms;
        }
    });
    
    if (maxOrigin > 0) {
        let inferredDelta = maxOrigin - new Date().getTime();
        if (activeServerPcToServerDelta === 0 || Math.abs(activeServerPcToServerDelta - inferredDelta) > 3600000) {
            activeServerPcToServerDelta = inferredDelta + 180000;
        }
    }
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

            const cleanup = () => {
                if (finished) return;
                finished = true;

                activeAudioElements = activeAudioElements.filter(a => a !== audio);
                clearTimeout(timeout);

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

// ==========================================
// 3. LOGIKA MENU GŁÓWNEGO I WYBÓR TRYBU
// ==========================================
const API_BASE = 'https://apis.simrail.tools';

// Dynamiczne dane SimRail nie mogą pochodzić z cache Chromium.
// Każde żądanie dostaje unikalny parametr czasu i cache: 'no-store'.
async function fetchJsonFresh(url, label = 'API') {
    const separator = url.includes('?') ? '&' : '?';
    const freshUrl = `${url}${separator}_ts=${Date.now()}`;

    const response = await fetch(freshUrl, {
        method: 'GET',
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(`${label}: HTTP ${response.status} ${response.statusText}`);
    }

    return await response.json();
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
let knownJourneyIds = new Set(); 
let isSyncing = false;
let globalActiveTrainsCount = 0; 

const trainSearch = document.getElementById('train-search');
const trainTypeFilter = document.getElementById('train-type-filter');
const trainSelect = document.getElementById('train-select');
const refreshTrainsBtn = document.getElementById('refresh-trains-btn');
const stationSelect = document.getElementById('station-select');

stationSelect.size = 8; 
stationSelect.style.width = '100%';
stationSelect.style.marginTop = '5px';

const stationSearchInput = document.createElement('input');
stationSearchInput.type = 'text';
stationSearchInput.id = 'station-search';
stationSearchInput.placeholder = 'Wpisz nazwę by przefiltrować...';
stationSearchInput.style.padding = '8px';
stationSearchInput.style.width = '100%';
stationSearchInput.style.boxSizing = 'border-box';
stationSearchInput.style.borderRadius = '5px';
stationSearchInput.style.border = '1px solid #333';
stationSearchInput.style.backgroundColor = '#1e1e1e';
stationSearchInput.style.color = '#fff';

if (stationSelect.parentElement) {
    stationSelect.parentElement.insertBefore(stationSearchInput, stationSelect);
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
    stationSelect.innerHTML = '';
    const query = filterText.toLowerCase();
    const filtered = stationListRaw.filter(st => st.toLowerCase().includes(query)).sort((a, b) => a.localeCompare(b));
    
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
            opt.textContent = st;
            stationSelect.appendChild(opt);
        });
    }
}

stationSearchInput.addEventListener('input', (e) => {
    loadStaticStations(e.target.value);
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
        serverSelect.innerHTML = '<option value="">Ładowanie...</option>';
        refreshServersBtn.disabled = true;
        modeSelectionDiv.classList.add('disabled');
        
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
        
        serverSelect.innerHTML = '<option value="">-- Wybierz serwer --</option>';
        servers.forEach(srv => {
            let delta = 0;
            const possibleProps = ['simulatorTime', 'simulatorTimeInMs', 'simulatedTime', 'serverTime', 'simTime'];
            for (let prop of possibleProps) {
                if (srv[prop]) {
                    let ms = new Date(srv[prop]).getTime();
                    if (!isNaN(ms) && ms > 1000000000000) {
                        delta = ms - new Date().getTime();
                        break;
                    }
                }
            }

            serversMap[srv.code] = { 
                id: srv.id, 
                utcOffsetHours: srv.utcOffsetHours || 0,
                pcToServerDelta: delta
            };

            const opt = document.createElement('option');
            opt.value = srv.code;
            opt.textContent = `${srv.code.toUpperCase()} - Serwer Aktywny`;
            serverSelect.appendChild(opt);
        });
        
        refreshServersBtn.disabled = false;
    } catch (err) {
        serverSelect.innerHTML = '<option value="">Błąd API SIT</option>';
        refreshServersBtn.disabled = false;
    }
}
refreshServersBtn.addEventListener('click', loadServers);

serverSelect.addEventListener('change', () => {
    if (serverSelect.value) {
        const sData = serversMap[serverSelect.value];
        currentServerId = sData.id;
        activeServerUtcOffset = sData.utcOffsetHours;
        activeServerPcToServerDelta = sData.pcToServerDelta;

        modeSelectionDiv.classList.remove('disabled');
        stationSelect.disabled = false;
        stationSearchInput.disabled = false;
        loadTrainsForOnboard(serverSelect.value);
    } else {
        loadServers(); 
    }
    checkStartCondition();
});

stationSelect.addEventListener('change', checkStartCondition);
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
        if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px;">Zatrzymano system stacyjny.</td></tr>';
        
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

// ==========================================
// 4. TRYB STACYJNY (DYŻURNY RUCHU)
// ==========================================
const STATION_REFRESH_MS = 15000;
const STATION_GPS_AT_PLATFORM_METERS = 300;
const STATION_ANNOUNCE_DISTANCE_METERS = 1000;
const STATION_MISSING_LIMIT = 4; // 4 x 15 s = ok. 60 s przed uznaniem pociągu za odwołany
const STATION_DEPARTURE_FALLBACK_MS = 3 * 60000;

function normalizeDelayMinutes(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.round(number));
}

function toTimestamp(value) {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}

function getStationTrainSpeechInfo(t) {
    let trainType = 'pociąg regionalny';
    let reservationSuffix = '';

    if (t.trainCategory.includes('EIP') || t.trainName.includes('EIP')) {
        trainType = 'pociąg dalekobieżny intercity';
        reservationSuffix = ' Pociąg jest objęty obowiązkową rezerwacją miejsc.';
    } else if (t.trainCategory.includes('Łs') || t.trainName.includes('Łs')) {
        trainType = 'pociąg pośpieszny';
    } else if (t.trainCategory.includes('MPE')) {
        trainType = 'pociąg dalekobieżny TLK';
        reservationSuffix = ' Pociąg jest objęty obowiązkową rezerwacją miejsc.';
    } else if (["NATIONAL_EXPRESS_TRAIN", "INTER_NATIONAL_EXPRESS_TRAIN"].includes(t.trainTypeRaw) && !t.trainName.includes('EIJ')) {
        trainType = 'pociąg pospieszny Intercity';
        reservationSuffix = ' Pociąg jest objęty obowiązkową rezerwacją miejsc.';
    }

    const rawNumber = t.trainName.split(' ')[1] || t.trainName;
    const number = formatTrainNumberForTTS(rawNumber);
    const viaText = t.viaText ? `, przez stacje: ${t.viaText}` : '';

    return { trainType, reservationSuffix, number, viaText };
}

function buildStationStandardAnnouncement(t) {
    const { trainType, reservationSuffix, number, viaText } = getStationTrainSpeechInfo(t);
    const className = trainType.charAt(0).toUpperCase() + trainType.slice(1);

    // Na stacji początkowej lub gdy pociąg już stoi przy peronie mówimy o odjeździe.
    const departureContext = !t.rawArrTime || t.gpsStatus === 'Na stacji';
    if (departureContext) {
        const time = formatServerTimeStr(t.actualDepTime);
        return `${className}, ${number} do stacji ${t.destination}${viaText}, odjedzie o godzinie ${time}.${reservationSuffix}`;
    }

    const time = formatServerTimeStr(t.actualArrTime);
    return `${className}, ${number} do stacji ${t.destination}${viaText}, przyjedzie o godzinie ${time}.${reservationSuffix} Prosimy zachować ostrożność i nie zbliżać się do krawędzi peronu.`;
}

function buildStationDelayAnnouncement(t) {
    const { trainType, number } = getStationTrainSpeechInfo(t);
    const className = trainType.charAt(0).toUpperCase() + trainType.slice(1);
    const departureContext = !t.rawArrTime || t.gpsStatus === 'Na stacji';
    const scheduledTime = departureContext ? t.rawDepTime : t.rawArrTime;
    const timeToSpeak = formatServerTimeStr(scheduledTime);
    const eventWord = departureContext ? 'odjazd' : 'przyjazd';
    const eventAction = departureContext ? 'odjedzie' : 'przyjedzie';

    return `Uwaga. ${className} ${number}, planowy ${eventWord} pociągu o godzinie ${timeToSpeak}, ${eventAction} z opóźnieniem około ${t.delayMin} minut. Opóźnienie może ulec zmianie. Przepraszamy za opóźnienie.`;
}

function getDisplayedStationJourneyIds() {
    return new Set(
        [...stationTimetable]
            .filter(t => !t.isPassing)
            .sort((a, b) => a.actualDepTime - b.actualDepTime)
            .slice(0, 10)
            .map(t => t.journeyId)
    );
}

async function startStationMode() {
    activeStationName = stationSelect.value;
    setupScreen.style.display = 'none';
    stationScreen.style.display = 'flex';
    departedHistory = [];
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
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color: #ffcc00;">Łączenie z API SimRail...</td></tr>';

    stationTimetable = [];
    knownJourneyIds = new Set();

    try {
        const activeTrains = await fetchJsonFresh(
            `${API_BASE}/sit-journeys/v2/active?serverId=${currentServerId}`,
            'Aktywne pociągi - stacja'
        );

        syncTimeWithActiveTrains(activeTrains);
        globalActiveTrainsCount = activeTrains ? activeTrains.length : 0;

        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color: #ffcc00;">Skanowanie mapy pociągów...<br><small style="color:#aaa;">(Wykryto ${globalActiveTrainsCount} aktywnych składów na serwerze)</small></td></tr>`;

        await syncNewTrains(activeTrains);
    } catch (err) {
        console.error('[STACJA] Błąd pobierania rozkładu:', err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">Błąd połączenia z siecią.</td></tr>';
    }
}

async function syncNewTrains(activeTrains) {
    if (isSyncing || !Array.isArray(activeTrains)) return;
    isSyncing = true;

    try {
        const newTrains = activeTrains.filter(t => !knownJourneyIds.has(t.journeyId));
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

                    const stationEvs = data.events.filter(ev =>
                        ev.stopPlace &&
                        ev.stopPlace.name &&
                        ev.stopPlace.name.trim().toLowerCase() === normalizedActiveStation
                    );

                    if (stationEvs.length === 0) return;

                    const arrEvent = stationEvs.find(e => e.type === 'ARRIVAL') || null;
                    const depEvent = stationEvs.find(e => e.type === 'DEPARTURE') || null;
                    const mainEvent = arrEvent || depEvent || stationEvs[0];

                    const liveDelay = t.liveData && t.liveData.delay !== undefined
                        ? normalizeDelayMinutes(t.liveData.delay)
                        : null;

                    let eventDelay = 0;
                    if (mainEvent.realtimeTime && mainEvent.scheduledTime) {
                        const realtimeMs = toTimestamp(mainEvent.realtimeTime);
                        const scheduledMs = toTimestamp(mainEvent.scheduledTime);
                        if (realtimeMs !== null && scheduledMs !== null) {
                            eventDelay = normalizeDelayMinutes((realtimeMs - scheduledMs) / 60000);
                        }
                    }

                    const delay = liveDelay !== null ? liveDelay : eventDelay;

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

                    const plat = mainEvent.platform || (mainEvent.edr && mainEvent.edr.platform) || (t.liveData && t.liveData.platform) || mainEvent.scheduledPlatform || '1';
                    const trk = mainEvent.track || (mainEvent.edr && mainEvent.edr.track) || (t.liveData && t.liveData.track) || mainEvent.scheduledTrack || '1';
                    const stLat = mainEvent.stopPlace?.position?.latitude || 0;
                    const stLon = mainEvent.stopPlace?.position?.longitude || 0;

                    const viaArray = futureEvents
                        .filter(e => e.stopType === 'PASSENGER' && e.stopPlace?.name)
                        .map(e => e.stopPlace.name)
                        .filter(name => name.toLowerCase() !== activeStationName.toLowerCase());

                    let viaText = '';
                    if (viaArray.length > 0) {
                        viaText = viaArray[0];
                        if (viaArray.length > 2) viaText += `, ${viaArray[Math.floor(viaArray.length / 2)]}`;
                    }

                    const isPassing = (
                        mainEvent.stopType === 'PASSING' ||
                        mainEvent.stopType === 'NONE' ||
                        mainEvent.type === 'PASSING' ||
                        (!arrEvent && !depEvent)
                    );

                    if (actualDepTime + 60000 > now && !stationTimetable.some(existing => existing.journeyId === t.journeyId)) {
                        stationTimetable.push({
                            journeyId: t.journeyId,
                            time: formatServerTimeStr(rawDepTime),
                            rawArrTime,
                            rawDepTime,
                            actualArrTime,
                            actualDepTime,
                            stLat,
                            stLon,
                            gpsStatus: 'Oczekuje',
                            departedAt: 0,
                            trainName: `${t.originEvent?.transport?.category || 'POC'} ${t.originEvent?.transport?.number || '0'}`,
                            trainCategory: t.originEvent?.transport?.category || 'POC',
                            trainTypeRaw: t.originEvent?.transport?.type || 'UNKNOWN',
                            destination: destName,
                            viaText,
                            platform: plat,
                            track: trk,
                            delayMin: delay,
                            // 0 oznacza brak opóźnienia. null powoduje jednorazowe ogłoszenie
                            // opóźnienia, jeżeli pociąg jest już opóźniony, gdy pojawi się na tablicy.
                            lastDelaySpoken: delay > 0 ? null : 0,
                            isPassing,
                            futureEvents,
                            announced: false,
                            departureAnnounced: false,
                            departedAdded: false,
                            cancelled: false,
                            cancelledTime: 0,
                            missingCount: 0
                        });
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

    const displayList = stationTimetable.filter(t => !t.isPassing).slice(0, 10);

    if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color: #8899aa;">Brak zaplanowanych przejazdów przez stację.<br><br><span style="font-size: 0.8em; opacity: 0.6;">Aktualnie na całym serwerze znajduje się ${globalActiveTrainsCount} aktywnych pociągów.</span></td></tr>`;
        return;
    }

    displayList.forEach(t => {
        const tr = document.createElement('tr');

        let typeStr = 'Osobowy / Regionalny';
        if (t.trainCategory.includes('EIP') || t.trainName.includes('EIP')) typeStr = 'Dalekobieżny / Intercity';
        else if (t.trainCategory.includes('Łs') || t.trainName.includes('Łs')) typeStr = 'Pośpieszny / Osobowy';
        else if (t.trainCategory.includes('MPE')) typeStr = 'Dalekobieżny / TLK';
        else if (["NATIONAL_EXPRESS_TRAIN", "INTER_NATIONAL_EXPRESS_TRAIN"].includes(t.trainTypeRaw) && !t.trainName.includes('EIJ')) typeStr = 'Dalekobieżny / Intercity';
        else if (t.trainName.includes('EIJ') || t.trainCategory.includes('ŁKA')) typeStr = 'Regionalny / Sprinter';

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
        } else if (t.gpsStatus === 'Odjechał' || (t.gpsStatus !== 'Na stacji' && now > t.actualDepTime + STATION_DEPARTURE_FALLBACK_MS)) {
            statusHtml = '<span style="color:#aaccff;">Odjechał</span>';
        } else if (t.gpsStatus === 'Na stacji') {
            statusHtml = '<span style="color:#00e676;">Na stacji</span>';
        } else if (t.delayMin > 0) {
            statusHtml = `<span style="color:#ff4444;">Opóźniony ${t.delayMin} min</span>`;
        } else {
            statusHtml = '<span style="color:#ffcc00;">Na czas</span>';
        }

        tr.innerHTML = `
            <td>${timeHtml}</td>
            <td><div class="plk-train-name">${t.trainName}</div><span class="plk-train-type">${typeStr}</span></td>
            <td><div class="plk-dest">${t.destination}</div>${t.viaText ? `<span class="plk-via">przez: ${t.viaText}</span>` : ''}</td>
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
                    t.missingCount = 0;
                    t.cancelled = false;
                    t.cancelledTime = 0;

                    if (trainActive.liveData) {
                        if (trainActive.liveData.delay !== undefined) {
                            t.delayMin = normalizeDelayMinutes(trainActive.liveData.delay);

                            // raw* przechowuje czas PLANOWY, więc opóźnienie dodajemy tylko raz.
                            if (t.rawArrTime) t.actualArrTime = t.rawArrTime + t.delayMin * 60000;
                            t.actualDepTime = t.rawDepTime + t.delayMin * 60000;
                            if (!t.rawArrTime) t.actualArrTime = t.actualDepTime;
                        }

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
                } else {
                    t.missingCount = (t.missingCount || 0) + 1;

                    // Jednorazowy brak pociągu w odpowiedzi API nie może oznaczać odwołania.
                    if (
                        t.missingCount >= STATION_MISSING_LIMIT &&
                        !t.isPassing &&
                        !t.cancelled &&
                        !t.departedAdded &&
                        now < t.actualDepTime
                    ) {
                        t.cancelled = true;
                        t.cancelledTime = now;
                        console.warn(`[STACJA] ${t.trainName} uznany za odwołany po ${t.missingCount} kolejnych brakach w API.`);
                    }
                }
            }

            // Po aktualizacji opóźnień kolejność TOP 10 może się zmienić.
            const displayedJourneyIds = getDisplayedStationJourneyIds();

            // ETAP 2: zapowiedzi, statusy i przenoszenie do historii.
            for (const t of stationTimetable) {
                const isDisplayed = displayedJourneyIds.has(t.journeyId);
                let standardAnnouncementPlayedThisCycle = false;

                // Komunikaty o opóźnieniu dotyczą pociągów widocznych na tablicy.
                if (isDisplayed && !t.cancelled && !t.isPassing && t.gpsStatus !== 'Odjechał') {
                    const previousSpokenDelay = t.lastDelaySpoken;

                    if (t.delayMin > 0 && previousSpokenDelay !== t.delayMin) {
                        playGongAndSpeak(buildStationDelayAnnouncement(t), stationVoice);
                        t.lastDelaySpoken = t.delayMin;
                        console.log(`[STACJA] Zapowiedź opóźnienia ${t.trainName}: +${t.delayMin} min.`);
                    } else if (t.delayMin === 0 && typeof previousSpokenDelay === 'number' && previousSpokenDelay > 0) {
                        // Zgodnie z założeniem: gdy opóźnienie znika, zamiast komunikatu
                        // „opóźnienie zlikwidowane” odtwarzamy zwykłą zapowiedź pociągu.
                        playGongAndSpeak(buildStationStandardAnnouncement(t), stationVoice);
                        t.lastDelaySpoken = 0;
                        standardAnnouncementPlayedThisCycle = true;
                        console.log(`[STACJA] ${t.trainName} wrócił do rozkładu – standardowa zapowiedź.`);
                    } else if (previousSpokenDelay === null && t.delayMin === 0) {
                        t.lastDelaySpoken = 0;
                    }
                }

                const targetTime = t.rawArrTime ? t.actualArrTime : t.actualDepTime;
                const timeDiffMinutes = (targetTime - now) / 60000;

                let shouldAnnounceArrival = false;
                if (!t.announced && !t.cancelled && t.gpsStatus === 'Oczekuje') {
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
                            if (t.delayMin > 0) {
                                // Zapowiedź przyjazdu opóźnionego pociągu pozostaje standardową
                                // zapowiedzią przyjazdu, ale jasno informuje, że pociąg jest opóźniony.
                                const { trainType, reservationSuffix, number, viaText } = getStationTrainSpeechInfo(t);
                                const time = formatServerTimeStr(t.actualArrTime);
                                speech = `Opóźniony ${trainType} ${number} do stacji ${t.destination}${viaText}, przyjedzie o godzinie ${time}.${reservationSuffix} Prosimy zachować ostrożność i nie zbliżać się do krawędzi peronu.`;
                            }
                            playGongAndSpeak(speech, stationVoice);
                        }
                    }
                }

                const stopDuration = Math.max(0, t.actualDepTime - t.actualArrTime);
                const timeDiffDepMinutes = (t.actualDepTime - now) / 60000;

                if (!t.cancelled && !t.isPassing && stopDuration > 3 * 60000) {
                    if (timeDiffDepMinutes <= 3 && timeDiffDepMinutes > 0 && !t.departureAnnounced) {
                        t.departureAnnounced = true;
                        const { trainType, number, viaText } = getStationTrainSpeechInfo(t);
                        const className = trainType.charAt(0).toUpperCase() + trainType.slice(1);
                        const formattedDep = formatServerTimeStr(t.actualDepTime);
                        playGongAndSpeak(`${className}, ${number} do stacji ${t.destination}${viaText}, odjedzie o godzinie ${formattedDep}.`, stationVoice);
                    }
                }

                let isPhysicallyDeparted = false;
                if (t.gpsStatus === 'Odjechał') {
                    isPhysicallyDeparted = true;
                } else if (now > t.actualDepTime + STATION_DEPARTURE_FALLBACK_MS && t.gpsStatus !== 'Na stacji') {
                    // Fallback czasowy tylko z marginesem 3 min, a nie natychmiast po godzinie odjazdu.
                    isPhysicallyDeparted = true;
                }

                if (isPhysicallyDeparted && !t.departedAdded && !t.cancelled) {
                    if (t.departedAt === 0) t.departedAt = now;
                    departedHistory.push({ ...t, departedAt: t.departedAt });
                    t.departedAdded = true;
                }
            }

            stationTimetable = stationTimetable.filter(t => {
                if (t.cancelled) return now <= t.cancelledTime + 2 * 60000;
                if (t.departedAdded) return now <= t.departedAt + 60000;
                return true;
            });

            if (!isSyncing) renderStationBoard();

            if (document.getElementById('departed-modal').style.display === 'flex') {
                renderDepartedModal();
            }
        } catch (err) {
            console.error('[STACJA] Błąd śledzenia tablicy stacyjnej:', err);
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
        activeServerUtcOffset = sData.utcOffsetHours;
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

        const passengerTrainTypes = ["NATIONAL_EXPRESS_TRAIN", "INTER_NATIONAL_EXPRESS_TRAIN", "INTER_REGIONAL_EXPRESS_TRAIN", "INTER_REGIONAL_TRAIN", "REGIONAL_FAST_TRAIN", "REGIONAL_TRAIN"];
        const passengerTrains = trains.filter(t => passengerTrainTypes.includes(t.originEvent?.transport?.type));

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
        trainSearch.placeholder = 'Błąd sieci';
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
        
        let isExpress = false;
        if (info.includes("EIP") || info.includes("MPE") || (["NATIONAL_EXPRESS_TRAIN", "INTER_NATIONAL_EXPRESS_TRAIN"].includes(t.type) && !info.includes("EIJ") && !info.includes("ŁS"))) {
            isExpress = true;
        }

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
            const delayStr = stop.delayMin > 0 ? ` <span style="color:#ff4444">(+${stop.delayMin} min)</span>` : '';
            mainTime.innerHTML = `${stop.state === 'at-station' ? (stop.departureTime || stop.time) : (stop.arrivalTime || stop.time)}${delayStr}`;
        }
    });
    adjustRouteFontsOnboard();
}

async function startOnboardMode() {
    activeJourneyId = trainSelect.value;
    const selectedOption = trainSelect.options[trainSelect.selectedIndex];
    
    activeDestination = selectedOption.dataset.destination;
    
    const trainInfoText = selectedOption.dataset.trainInfo.toUpperCase();
    if (trainInfoText.includes("EIP") || trainInfoText.includes("MPE") || (["NATIONAL_EXPRESS_TRAIN", "INTER_NATIONAL_EXPRESS_TRAIN"].includes(selectedOption.dataset.type) && !trainInfoText.includes("EIJ") && !trainInfoText.includes("ŁS"))) {
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

    await loadJourneyRouteOnboard(activeJourneyId, initialLat, initialLon);
    startOnboardLiveTracking();
}

async function loadJourneyRouteOnboard(journeyId, trainLat, trainLon) {
    try {
        const journeyData = await fetchJsonFresh(
            `${API_BASE}/sit-journeys/v2/by-id/${journeyId}`,
            'Trasa pociągu - start'
        );
        const stationsMap = new Map();
        
        if (journeyData.events && journeyData.events.length > 0) {
            journeyData.events.forEach((ev) => {
                if (ev.stopPlace && ev.stopPlace.name && ev.stopType === "PASSENGER") {
                    const name = ev.stopPlace.name;
                    if (!stationsMap.has(name)) {
                        stationsMap.set(name, { station: name, lat: ev.stopPlace.position.latitude, lon: ev.stopPlace.position.longitude, arrivalTime: null, departureTime: null, delayMin: 0 });
                    }
                    const st = stationsMap.get(name);
                    let delay = 0;
                    if (ev.realtimeTime && ev.scheduledTime) {
                        delay = Math.floor((new Date(ev.realtimeTime).getTime() - new Date(ev.scheduledTime).getTime()) / 60000); 
                        if (delay < 1) delay = 0; 
                    }
                    if (ev.type === "ARRIVAL") {
                        st.arrivalTime = formatServerTimeStr(ev.realtimeTime || ev.scheduledTime);
                        st.rawTime = new Date(ev.realtimeTime || ev.scheduledTime).getTime();
                        st.delayMin = delay;
                    } else if (ev.type === "DEPARTURE") {
                        st.departureTime = formatServerTimeStr(ev.realtimeTime || ev.scheduledTime);
                        if (!st.rawTime) st.rawTime = new Date(ev.realtimeTime || ev.scheduledTime).getTime();
                        st.delayMin = delay; 
                    }
                }
            });
            
            targetStationList = Array.from(stationsMap.values()).map(st => ({
                station: st.station, time: st.arrivalTime || st.departureTime, arrivalTime: st.arrivalTime, departureTime: st.departureTime, rawTime: st.rawTime, lat: st.lat, lon: st.lon, delayMin: st.delayMin, current: false, arrivalPlayed: false, departureAnnounced: false, warsAnnounced: false, minDistance: Infinity, state: 'inactive'
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
                        if (distFromPrev >= 500) targetStationList[activeIdx].departureAnnounced = true;
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
                            if (ev.stopPlace && ev.stopPlace.name && ev.stopType === "PASSENGER") {
                                const st = targetStationList.find(s => s.station === ev.stopPlace.name);
                                if (st) {
                                    let newDelay = 0;
                                    if (ev.realtimeTime && ev.scheduledTime) {
                                        newDelay = Math.floor((new Date(ev.realtimeTime).getTime() - new Date(ev.scheduledTime).getTime()) / 60000);
                                        if (newDelay < 1) newDelay = 0;
                                    }
                                    st.delayMin = newDelay;
                                    if(ev.type === "ARRIVAL") st.arrivalTime = formatServerTimeStr(ev.realtimeTime || ev.scheduledTime);
                                    if(ev.type === "DEPARTURE") st.departureTime = formatServerTimeStr(ev.realtimeTime || ev.scheduledTime);
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
                if (distFromPrev >= 500 && !targetStation.departureAnnounced && !targetStation.arrivalPlayed) {
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