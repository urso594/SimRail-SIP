const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_BUILD_TAG = 'simrail-sip-by-urso-2.2.1-release-2026-08-28';
console.log(`[SimRail SIP by Urso] Build: ${APP_BUILD_TAG}`);

const APP_LANGUAGE_STORAGE_KEY = 'simrail-sip:interface-language';
const SUPPORTED_INTERFACE_LANGUAGES = new Set(['pl', 'en']);
const UI_TRANSLATIONS = Object.freeze({
    pl: {
        'common.loading': 'Ładowanie...',
        'common.loadingData': 'Wczytywanie...',
        'common.back': 'Powrót do wyboru',
        'common.close': 'Zamknij',
        'common.closeWindow': 'Zamknij okno',
        'settings.open': 'Ustawienia',
        'settings.openAria': 'Otwórz ustawienia',
        'settings.closeAria': 'Zamknij ustawienia',
        'settings.title': 'Ustawienia',
        'settings.subtitle': 'Dostosuj język, dźwięk oraz sposób odtwarzania zapowiedzi.',
        'settings.applicationAndSound': 'Program i dźwięk',
        'settings.interfaceLanguage': 'Język programu',
        'settings.languagePolish': 'Polski',
        'settings.languageEnglish': 'English',
        'settings.volume': 'Głośność komunikatów',
        'settings.testAnnouncement': 'Testuj zapowiedź',
        'settings.stationMessages': 'Komunikaty stacyjne',
        'settings.randomMessages': 'Losowe komunikaty co 5 minut',
        'settings.refreshCountdownInitial': 'Odświeżanie tablicy za: 15s',
        'settings.onboardAnnouncements': 'Zapowiedzi pokładowe',
        'settings.regionalAnnouncements': 'Zapowiedzi regionalne',
        'settings.regionalAnnouncementsAria': 'Sposób odtwarzania zapowiedzi regionalnych',
        'settings.longDistanceAnnouncements': 'Zapowiedzi dalekobieżne',
        'settings.longDistanceAnnouncementsAria': 'Sposób odtwarzania zapowiedzi dalekobieżnych',
        'settings.synthesizer': 'Syntezator',
        'settings.recordedVoice': 'Lektor',
        'settings.recordedSoon': 'Lektor — dostępne wkrótce',
        'settings.synthPolishOnly': 'Syntezator odtwarza wszystkie zapowiedzi wyłącznie po polsku.',
        'settings.recordedLanguageInfo': 'Lektor używa języka programu, a nazwy stacji pozostają wymawiane po polsku.',
        'settings.whatsNew': 'Co nowego?',
        'setup.server': 'Serwer:',
        'setup.refreshServers': 'Odśwież listę serwerów',
        'setup.onboardMode': '🚆 Tryb Pokładowy<br><span>(Dla Maszynisty)</span>',
        'setup.stationMode': '🚉 Tryb Stacyjny<br><span>(Dla Dyżurnego)</span>',
        'setup.train': 'Pociąg:',
        'setup.filterAll': 'Wszystkie rodzaje',
        'setup.filterExpress': 'Dalekobieżne (Intercity / TLK)',
        'setup.filterRegional': 'Regionalne i Osobowe',
        'setup.refreshTrains': 'Odśwież listę pociągów',
        'setup.trainSearch': 'Wpisz numer by przefiltrować...',
        'setup.selectServerFirst': '-- Wybierz serwer najpierw --',
        'setup.selectStation': 'Wybierz stację:',
        'setup.stationSearch': 'Wpisz nazwę by przefiltrować...',
        'setup.start': 'Uruchom System SIP',
        'setup.addFavoriteServer': 'Dodaj wybrany serwer do ulubionych',
        'setup.removeFavoriteServer': 'Usuń wybrany serwer z ulubionych',
        'setup.addFavoriteStation': 'Dodaj wybraną stację do ulubionych',
        'setup.removeFavoriteStation': 'Usuń wybraną stację z ulubionych',
        'setup.selectServer': '-- Wybierz serwer --',
        'setup.activeServer': '{code} - Serwer Aktywny',
        'setup.noStations': 'Brak stacji',
        'setup.apiError': 'Błąd API SIT',
        'onboard.refresh': 'Odśwież dane pociągu',
        'onboard.nextStation': 'NASTĘPNA STACJA:',
        'onboard.station': 'STACJA:',
        'onboard.plannedArrival': 'PLANOWY PRZYJAZD:',
        'onboard.plannedDeparture': 'PLANOWY ODJAZD:',
        'onboard.direction': '{train} • Kierunek: {destination}',
        'route.progress': 'POSTĘP TRASY',
        'route.progressAria': 'Postęp trasy',
        'route.approximateProgress': 'Przybliżony postęp trasy',
        'route.waiting': 'Oczekiwanie na dane trasy',
        'route.zeroStations': '0 z 0 stacji',
        'route.progressWaitingAria': 'Postęp trasy: oczekiwanie na dane',
        'route.originFallback': 'Początek trasy',
        'route.destinationFallback': 'Koniec trasy',
        'route.atStation': 'Na stacji: {station}',
        'route.routeStart': 'Początek trasy: {station}',
        'route.toStation': 'W drodze do: {station}',
        'route.stationStage': 'Stacja {current} z {total}',
        'route.segmentStage': 'Odcinek {current} z {total}',
        'route.progressValueAria': 'Postęp trasy: {percent} procent. {status}',
        'station.stationEmpty': 'STACJA: ---',
        'station.stationNamed': 'STACJA: {station}',
        'station.refresh': 'Odśwież dane tablicy',
        'station.dispatchedTrains': 'Odprawione Pociągi',
        'station.cancelledTrains': 'Pociągi odwołane',
        'station.departuresTitle': 'ODJAZDY / DEPARTURES',
        'station.headerTime': 'Godzina<br><span class="en">Time</span>',
        'station.headerTrain': 'Pociąg<br><span class="en">Train</span>',
        'station.headerDestination': 'Kierunek / Przez<br><span class="en">Destination / Via</span>',
        'station.headerPlatform': 'Peron<br><span class="en">Platform</span>',
        'station.headerTrack': 'Tor<br><span class="en">Track</span>',
        'station.headerStatus': 'Status<br><span class="en">Status</span>',
        'station.loadingSchedule': 'Pobieranie rozkładu jazdy dla stacji...',
        'station.refreshCountdown': 'Odświeżanie danych za: {seconds}s',
        'station.stopped': 'Zatrzymano system stacyjny.',
        'station.loadingFullSchedule': 'Pobieranie pełnego rozkładu stacji...',
        'station.scanningMap': 'Skanowanie mapy pociągów...',
        'station.detectedActive': '(Wykryto {count} aktywnych składów na serwerze)',
        'station.noData': 'Brak danych do wyświetlenia. Użyj przycisku odświeżania.',
        'station.emptyBoard': 'Brak zaplanowanych przejazdów przez stację.',
        'station.activeOnServer': 'Aktualnie na całym serwerze znajduje się {count} aktywnych pociągów.',
        'station.typeRegional': 'Osobowy / Regionalny',
        'station.typeExpressPremium': 'Intercity / Express Premium',
        'station.typeLkaExpress': 'Regionalny / Pośpieszny ŁKA',
        'station.typeLongDistance': 'Dalekobieżny / Intercity',
        'station.typeFastPassenger': 'Pośpieszny / Osobowy',
        'station.typeTlk': 'Dalekobieżny / TLK',
        'station.typeSprinter': 'Regionalny / Sprinter',
        'station.arrivalShort': 'Przyj:',
        'station.departureShort': 'Odj:',
        'station.via': 'przez: {via}',
        'station.statusCancelled': 'Odwołany',
        'station.statusScheduled': 'Zaplanowany',
        'station.statusDeparted': 'Odjechał',
        'station.statusAtStation': 'Na stacji',
        'station.statusDelayed': 'Opóźniony {minutes} min',
        'station.statusOnTime': 'Na czas',
        'history.dispatchedTitle': 'Pociągi, które odjechały',
        'history.cancelledTitle': 'Pociągi odwołane',
        'history.noDispatched': 'Brak pociągów, które odjechały.',
        'history.noCancelled': 'Brak pociągów odwołanych podczas bieżącej pracy tablicy.',
        'history.toStation': 'do stacji {station}',
        'history.departedMinutes': 'Odjechał {minutes} minut temu',
        'history.cancelledMinutes': 'Odwołany {minutes} minut temu',
        'trains.loading': 'Pobieranie pociągów...',
        'trains.loadingShort': 'Pobieranie...',
        'trains.noneOnServer': 'Brak pociągów na serwerze',
        'trains.nonePassenger': 'Brak pociągów pasażerskich',
        'trains.none': 'Brak pociągów',
        'trains.search': 'Wpisz numer by przefiltrować...',
        'trains.apiStale': 'API zwraca nieaktualne dane',
        'trains.apiError': 'Błąd API',
        'trains.staleOption': 'Nieaktualne dane API',
        'trains.noConnection': 'Brak połączenia z API',
        'trains.noMatches': 'Brak pociągów spełniających kryteria',
        'trains.option': '{train} (Kierunek: {destination})',
        'trains.staleReason': 'API zwraca nieaktualne dane. Poczekaj na przywrócenie działania i kliknij odśwież.',
        'trains.connectionReason': 'Brak poprawnego połączenia z API. Kliknij odśwież i spróbuj ponownie.',
        'api.staleWarning': 'Zewnętrzna awaria API SimRail niezależna od programu SIP. Dane mogą być nieaktualne',
        'api.hint': 'Kliknij po szczegóły',
        'api.expand': 'Kliknij, aby rozwinąć informacje o API.',
        'api.collapse': 'Kliknij, aby zwinąć informacje o API do kolorowej kropki.',
        'api.checking': 'API: sprawdzanie...',
        'api.checkingAvailability': 'API: sprawdzanie dostępności...',
        'api.availableSelect': 'API: dostępne • wybierz serwer',
        'api.unavailable': 'API: NIEDOSTĘPNE — nie udało się pobrać listy serwerów',
        'api.checkingCode': 'API: SPRAWDZANIE • {code}',
        'api.ok': 'API: OK',
        'api.okCode': 'API: OK • {code}',
        'api.staleCode': 'API: NIEAKTUALNE DANE • {code}',
        'api.noResponse': 'API: BRAK ODPOWIEDZI',
        'api.connectionError': 'API: BŁĄD POŁĄCZENIA',
        'whatsNew.version': 'Wersja {version}',
        'whatsNew.title': 'Co nowego w SimRail SIP by Urso?',
        'whatsNew.subtitle': 'Najważniejsze zmiany i usprawnienia w tej wersji programu.',
        'whatsNew.recordingPacing': '<strong>Naturalniejsze tempo lektora:</strong> przerwa między kolejnymi częściami nagranej zapowiedzi została wydłużona z 0,3 do 0,7 sekundy.',
        'whatsNew.jackowiceRecording': '<strong>Uzupełniona biblioteka stacji:</strong> dodano brakujące nagranie Jackowic oraz poprawiono nazwę pliku Radziwiłłów Mazowiecki, aby nagrania były prawidłowo dopasowywane do nazw zwracanych przez API.',
        'whatsNew.confirm': 'Rozumiem'
    },
    en: {
        'common.loading': 'Loading...',
        'common.loadingData': 'Loading data...',
        'common.back': 'Back to selection',
        'common.close': 'Close',
        'common.closeWindow': 'Close window',
        'settings.open': 'Settings',
        'settings.openAria': 'Open settings',
        'settings.closeAria': 'Close settings',
        'settings.title': 'Settings',
        'settings.subtitle': 'Adjust the language, sound and announcement playback method.',
        'settings.applicationAndSound': 'Application and sound',
        'settings.interfaceLanguage': 'Application language',
        'settings.languagePolish': 'Polski',
        'settings.languageEnglish': 'English',
        'settings.volume': 'Announcement volume',
        'settings.testAnnouncement': 'Test announcement',
        'settings.stationMessages': 'Station messages',
        'settings.randomMessages': 'Random messages every 5 minutes',
        'settings.refreshCountdownInitial': 'Board refresh in: 15s',
        'settings.onboardAnnouncements': 'Onboard announcements',
        'settings.regionalAnnouncements': 'Regional train announcements',
        'settings.regionalAnnouncementsAria': 'Regional train announcement playback method',
        'settings.longDistanceAnnouncements': 'Long-distance train announcements',
        'settings.longDistanceAnnouncementsAria': 'Long-distance train announcement playback method',
        'settings.synthesizer': 'Synthesizer',
        'settings.recordedVoice': 'Recorded voice',
        'settings.recordedSoon': 'Recorded voice — coming soon',
        'settings.synthPolishOnly': 'The synthesizer plays all announcements in Polish only.',
        'settings.recordedLanguageInfo': 'The recorded voice follows the application language, while station names remain spoken in Polish.',
        'settings.whatsNew': "What's new?",
        'setup.server': 'Server:',
        'setup.refreshServers': 'Refresh server list',
        'setup.onboardMode': '🚆 Onboard Mode<br><span>(For Drivers)</span>',
        'setup.stationMode': '🚉 Station Mode<br><span>(For Dispatchers)</span>',
        'setup.train': 'Train:',
        'setup.filterAll': 'All train types',
        'setup.filterExpress': 'Long-distance (Intercity / TLK)',
        'setup.filterRegional': 'Regional and passenger trains',
        'setup.refreshTrains': 'Refresh train list',
        'setup.trainSearch': 'Enter a train number to filter...',
        'setup.selectServerFirst': '-- Select a server first --',
        'setup.selectStation': 'Select a station:',
        'setup.stationSearch': 'Enter a station name to filter...',
        'setup.start': 'Start SIP System',
        'setup.addFavoriteServer': 'Add selected server to favorites',
        'setup.removeFavoriteServer': 'Remove selected server from favorites',
        'setup.addFavoriteStation': 'Add selected station to favorites',
        'setup.removeFavoriteStation': 'Remove selected station from favorites',
        'setup.selectServer': '-- Select a server --',
        'setup.activeServer': '{code} - Active Server',
        'setup.noStations': 'No stations',
        'setup.apiError': 'SIT API Error',
        'onboard.refresh': 'Refresh train data',
        'onboard.nextStation': 'NEXT STATION:',
        'onboard.station': 'STATION:',
        'onboard.plannedArrival': 'SCHEDULED ARRIVAL:',
        'onboard.plannedDeparture': 'SCHEDULED DEPARTURE:',
        'onboard.direction': '{train} • Destination: {destination}',
        'route.progress': 'ROUTE PROGRESS',
        'route.progressAria': 'Route progress',
        'route.approximateProgress': 'Approximate route progress',
        'route.waiting': 'Waiting for route data',
        'route.zeroStations': '0 of 0 stations',
        'route.progressWaitingAria': 'Route progress: waiting for data',
        'route.originFallback': 'Route origin',
        'route.destinationFallback': 'Route destination',
        'route.atStation': 'At station: {station}',
        'route.routeStart': 'Route origin: {station}',
        'route.toStation': 'En route to: {station}',
        'route.stationStage': 'Station {current} of {total}',
        'route.segmentStage': 'Section {current} of {total}',
        'route.progressValueAria': 'Route progress: {percent} percent. {status}',
        'station.stationEmpty': 'STATION: ---',
        'station.stationNamed': 'STATION: {station}',
        'station.refresh': 'Refresh board data',
        'station.dispatchedTrains': 'Dispatched Trains',
        'station.cancelledTrains': 'Cancelled Trains',
        'station.departuresTitle': 'DEPARTURES',
        'station.headerTime': 'Time',
        'station.headerTrain': 'Train',
        'station.headerDestination': 'Destination / Via',
        'station.headerPlatform': 'Platform',
        'station.headerTrack': 'Track',
        'station.headerStatus': 'Status',
        'station.loadingSchedule': 'Loading the station timetable...',
        'station.refreshCountdown': 'Data refresh in: {seconds}s',
        'station.stopped': 'Station system stopped.',
        'station.loadingFullSchedule': 'Loading the full station timetable...',
        'station.scanningMap': 'Scanning trains on the map...',
        'station.detectedActive': '({count} active trains detected on the server)',
        'station.noData': 'No data to display. Use the refresh button.',
        'station.emptyBoard': 'No scheduled services through this station.',
        'station.activeOnServer': 'There are currently {count} active trains on the server.',
        'station.typeRegional': 'Passenger / Regional',
        'station.typeExpressPremium': 'Intercity / Express Premium',
        'station.typeLkaExpress': 'Regional / ŁKA Express',
        'station.typeLongDistance': 'Long-distance / Intercity',
        'station.typeFastPassenger': 'Fast / Passenger',
        'station.typeTlk': 'Long-distance / TLK',
        'station.typeSprinter': 'Regional / Sprinter',
        'station.arrivalShort': 'Arr:',
        'station.departureShort': 'Dep:',
        'station.via': 'via: {via}',
        'station.statusCancelled': 'Cancelled',
        'station.statusScheduled': 'Scheduled',
        'station.statusDeparted': 'Departed',
        'station.statusAtStation': 'At station',
        'station.statusDelayed': 'Delayed {minutes} min',
        'station.statusOnTime': 'On time',
        'history.dispatchedTitle': 'Dispatched trains',
        'history.cancelledTitle': 'Cancelled trains',
        'history.noDispatched': 'No dispatched trains.',
        'history.noCancelled': 'No trains were cancelled during the current board session.',
        'history.toStation': 'to {station}',
        'history.departedMinutes': 'Departed {minutes} minutes ago',
        'history.cancelledMinutes': 'Cancelled {minutes} minutes ago',
        'trains.loading': 'Loading trains...',
        'trains.loadingShort': 'Loading...',
        'trains.noneOnServer': 'No trains on this server',
        'trains.nonePassenger': 'No passenger trains',
        'trains.none': 'No trains',
        'trains.search': 'Enter a train number to filter...',
        'trains.apiStale': 'The API is returning stale data',
        'trains.apiError': 'API error',
        'trains.staleOption': 'Stale API data',
        'trains.noConnection': 'No API connection',
        'trains.noMatches': 'No trains match the selected filters',
        'trains.option': '{train} (Destination: {destination})',
        'trains.staleReason': 'The API is returning stale data. Wait for service to be restored and click refresh.',
        'trains.connectionReason': 'No valid API connection. Click refresh and try again.',
        'api.staleWarning': 'External SimRail API failure independent of the SIP application. Data may be outdated',
        'api.hint': 'Click for details',
        'api.expand': 'Click to expand API information.',
        'api.collapse': 'Click to collapse API information to a status dot.',
        'api.checking': 'API: checking...',
        'api.checkingAvailability': 'API: checking availability...',
        'api.availableSelect': 'API: available • select a server',
        'api.unavailable': 'API: UNAVAILABLE — failed to retrieve the server list',
        'api.checkingCode': 'API: CHECKING • {code}',
        'api.ok': 'API: OK',
        'api.okCode': 'API: OK • {code}',
        'api.staleCode': 'API: STALE DATA • {code}',
        'api.noResponse': 'API: NO RESPONSE',
        'api.connectionError': 'API: CONNECTION ERROR',
        'whatsNew.version': 'Version {version}',
        'whatsNew.title': "What's new in SimRail SIP by Urso?",
        'whatsNew.subtitle': 'The most important changes and improvements in this version.',
        'whatsNew.recordingPacing': '<strong>More natural recorded-voice pacing:</strong> the pause between consecutive parts of a recorded announcement has been increased from 0.3 to 0.7 seconds.',
        'whatsNew.jackowiceRecording': '<strong>Expanded station library:</strong> the missing Jackowice recording was added and the Radziwiłłów Mazowiecki filename was corrected so recordings are matched properly to station names returned by the API.',
        'whatsNew.confirm': 'Got it'
    }
});

let currentInterfaceLanguage = 'pl';
try {
    const savedLanguage = localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
    if (SUPPORTED_INTERFACE_LANGUAGES.has(savedLanguage)) currentInterfaceLanguage = savedLanguage;
} catch (err) {
    console.warn('[JĘZYK] Nie udało się odczytać ustawienia języka:', err);
}

function uiText(key, replacements = {}) {
    const languageTable = UI_TRANSLATIONS[currentInterfaceLanguage] || UI_TRANSLATIONS.pl;
    const template = languageTable[key] ?? UI_TRANSLATIONS.pl[key] ?? key;

    return String(template).replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(replacements, name) ? String(replacements[name]) : match
    );
}

function setLocalizedPlaceholder(element, translationKey) {
    if (!element) return;
    element.dataset.i18nPlaceholderState = translationKey;
    element.placeholder = uiText(translationKey);
}

function applyStaticInterfaceTranslations() {
    document.documentElement.lang = currentInterfaceLanguage;

    document.querySelectorAll('[data-i18n]').forEach(element => {
        element.textContent = uiText(element.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(element => {
        element.innerHTML = uiText(element.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        element.placeholder = uiText(
            element.dataset.i18nPlaceholderState || element.dataset.i18nPlaceholder
        );
    });
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        element.title = uiText(element.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
        element.setAttribute('aria-label', uiText(element.dataset.i18nAriaLabel));
    });

    const languageSelect = document.getElementById('app-language-select');
    if (languageSelect) languageSelect.value = currentInterfaceLanguage;
}

function setInterfaceLanguage(language, persist = true) {
    currentInterfaceLanguage = SUPPORTED_INTERFACE_LANGUAGES.has(language) ? language : 'pl';

    if (persist) {
        try {
            localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, currentInterfaceLanguage);
        } catch (err) {
            console.warn('[JĘZYK] Nie udało się zapisać ustawienia języka:', err);
        }
    }

    applyStaticInterfaceTranslations();
    refreshLocalizedInterface();
}

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
const onboardDataRefreshBtn = document.getElementById('onboard-data-refresh-btn');
const stationDataRefreshBtn = document.getElementById('station-data-refresh-btn');
const onboardApiWarning = document.getElementById('onboard-api-warning');
const stationApiWarning = document.getElementById('station-api-warning');

const settingsBtns = document.querySelectorAll('.settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsButton = document.getElementById('close-settings');
const closeSettingsIcon = document.getElementById('close-settings-icon');
const testAnnouncementBtn = document.getElementById('test-announcement-btn');
const appLanguageSelect = document.getElementById('app-language-select');
const volumeSlidersArray = document.querySelectorAll('.volume-slider');
const randomStationAnnouncementsToggles = document.querySelectorAll('.random-station-announcements-toggle');
const regionalAnnouncementModeSelects = document.querySelectorAll('.regional-announcement-mode-select');
const longDistanceAnnouncementModeSelects = document.querySelectorAll('.long-distance-announcement-mode-select');

const RANDOM_STATION_ANNOUNCEMENTS_STORAGE_KEY = 'simrail-sip:random-station-announcements-enabled';
const REGIONAL_ANNOUNCEMENT_MODE_STORAGE_KEY = 'simrail-sip:regional-announcement-mode';
const ANNOUNCEMENT_MODE_SYNTHESIZER = 'synthesizer';
const ANNOUNCEMENT_MODE_RECORDED = 'recorded';
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

let regionalAnnouncementMode = ANNOUNCEMENT_MODE_SYNTHESIZER;

try {
    const savedRegionalMode = localStorage.getItem(REGIONAL_ANNOUNCEMENT_MODE_STORAGE_KEY);
    if ([ANNOUNCEMENT_MODE_SYNTHESIZER, ANNOUNCEMENT_MODE_RECORDED].includes(savedRegionalMode)) {
        regionalAnnouncementMode = savedRegionalMode;
    }
} catch (err) {
    console.warn('[ZAPOWIEDZI REGIONALNE] Nie udało się odczytać ustawienia:', err);
}

function syncRegionalAnnouncementModeSelects() {
    regionalAnnouncementModeSelects.forEach(select => {
        select.value = regionalAnnouncementMode;
    });
}

syncRegionalAnnouncementModeSelects();
longDistanceAnnouncementModeSelects.forEach(select => {
    select.value = ANNOUNCEMENT_MODE_SYNTHESIZER;
});

regionalAnnouncementModeSelects.forEach(select => {
    select.addEventListener('change', () => {
        regionalAnnouncementMode = select.value === ANNOUNCEMENT_MODE_RECORDED
            ? ANNOUNCEMENT_MODE_RECORDED
            : ANNOUNCEMENT_MODE_SYNTHESIZER;

        syncRegionalAnnouncementModeSelects();

        try {
            localStorage.setItem(REGIONAL_ANNOUNCEMENT_MODE_STORAGE_KEY, regionalAnnouncementMode);
        } catch (err) {
            console.warn('[ZAPOWIEDZI REGIONALNE] Nie udało się zapisać ustawienia:', err);
        }
    });
});

function shouldUseRegionalRecordedAnnouncements() {
    return regionalAnnouncementMode === ANNOUNCEMENT_MODE_RECORDED;
}

let activeAudioElements = []; 

function openSettingsModal() {
    if (!settingsModal) return;

    settingsModal.classList.remove('hidden');
    requestAnimationFrame(() => closeSettingsIcon?.focus());
}

function closeSettingsModal() {
    if (!settingsModal) return;

    settingsModal.classList.add('hidden');
}

settingsBtns.forEach(btn => btn.addEventListener('click', openSettingsModal));
closeSettingsButton?.addEventListener('click', closeSettingsModal);
closeSettingsIcon?.addEventListener('click', closeSettingsModal);

settingsModal?.addEventListener('click', (event) => {
    if (event.target === settingsModal) closeSettingsModal();
});

appLanguageSelect?.addEventListener('change', () => {
    setInterfaceLanguage(appLanguageSelect.value);
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

testAnnouncementBtn?.addEventListener('click', () => {
    playGongAndSpeak('To jest testowa zapowiedź systemu informacji pasażerskiej. Dźwięk działa poprawnie.', 'pl-PL-ZofiaNeural');
});

const CHANGELOG_STORAGE_KEY = 'simrail-sip:last-shown-changelog-version';
const CHANGELOG_FALLBACK_VERSION = '2.2.1';
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
        closeSettingsModal();
        openWhatsNewModal();
    });
});

closeWhatsNewButton?.addEventListener('click', closeWhatsNewModal);
closeWhatsNewIcon?.addEventListener('click', closeWhatsNewModal);

whatsNewModal?.addEventListener('click', (event) => {
    if (event.target === whatsNewModal) closeWhatsNewModal();
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    if (whatsNewModal && !whatsNewModal.classList.contains('hidden')) {
        closeWhatsNewModal();
        return;
    }

    if (settingsModal && !settingsModal.classList.contains('hidden')) closeSettingsModal();
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

    if (whatsNewVersion) whatsNewVersion.textContent = uiText('whatsNew.version', { version: currentAppVersion });

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
    hint.textContent = uiText('api.hint');
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
    let replacements = {};
    try {
        replacements = JSON.parse(el.dataset.i18nReplacements || '{}');
    } catch (err) {
        console.warn('[JĘZYK] Nie udało się odczytać parametrów komunikatu API:', err);
    }
    const message = el.dataset.i18nKey
        ? uiText(el.dataset.i18nKey, replacements)
        : (el.dataset.message || uiText('api.checking'));
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
        el.title = `${message}\n${uiText('api.expand')}`;
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
        el.title = uiText('api.collapse');
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
    el.dataset.i18nKey = 'api.checking';
    el.dataset.i18nReplacements = '{}';
    el.dataset.message = uiText('api.checking');

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

function setApiHealthStatus(state, translationKey, replacements = {}) {
    const el = getApiStatusElement();

    // Zmiana stanu API aktualizuje treść/kolor, ale po zakończeniu krótkiej
    // prezentacji startowej nie rozwija kontrolki automatycznie.
    el.dataset.state = state;
    el.dataset.i18nKey = translationKey;
    el.dataset.i18nReplacements = JSON.stringify(replacements);
    el.dataset.message = uiText(translationKey, replacements);
    el.style.display = 'block';
    renderApiStatusElement(el);
    startApiStatusIntroIfNeeded(el);
}

function setModeApiWarning(mode, visible) {
    const warning = mode === 'station' ? stationApiWarning : onboardApiWarning;
    if (!warning) return;

    warning.textContent = uiText('api.staleWarning');
    warning.hidden = !visible;
}

function showApiWarningForVisibleMode() {
    if (stationScreen.style.display !== 'none') setModeApiWarning('station', true);
    if (sipScreen.style.display !== 'none') setModeApiWarning('onboard', true);
}

function hideApiWarnings() {
    setModeApiWarning('station', false);
    setModeApiWarning('onboard', false);
}

function isApiDataRefreshError(err) {
    return !err?.code || [
        'STALE_API_DATA',
        'API_TIMEOUT',
        'API_HTTP_ERROR',
        'API_FORMAT_ERROR',
        'API_ERROR'
    ].includes(err.code);
}

function handleVisibleModeApiError(err) {
    if (isApiDataRefreshError(err)) showApiWarningForVisibleMode();
}

function setModeRefreshButtonBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle('is-loading', busy);
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
        setApiHealthStatus('error', code ? 'api.staleCode' : 'api.connectionError', { code });
        showApiWarningForVisibleMode();
        throw makeApiError(selectedServerClockProblem, 'STALE_API_DATA');
    }

    const assessment = assessActiveTrainsFreshness(activeTrains);

    if (!assessment.ok) {
        setApiHealthStatus('error', code ? 'api.staleCode' : 'api.connectionError', { code });
        showApiWarningForVisibleMode();
        throw makeApiError(assessment.reason, 'STALE_API_DATA');
    }

    hideApiWarnings();

    if (isServerClockVerified() || isLiveDataVerified()) {
        setApiHealthStatus('ok', code ? 'api.okCode' : 'api.ok', { code });
    } else {
        setApiHealthStatus('checking', code ? 'api.checkingCode' : 'api.checking', { code });
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
        setApiHealthStatus('error', 'api.staleCode', { code });
        showApiWarningForVisibleMode();
        throw makeApiError(observation.reason, 'STALE_API_DATA');
    }

    selectedServerClockProblem = null;

    if (observation.pending && !isLiveDataVerified()) {
        setApiHealthStatus('checking', 'api.checkingCode', { code: activeServerCode.toUpperCase() });
    } else {
        setApiHealthStatus('ok', 'api.okCode', { code: activeServerCode.toUpperCase() });
    }

    return true;
}

function startServerClockHealthMonitor() {
    if (serverClockHealthInterval) clearInterval(serverClockHealthInterval);
    serverClockHealthInterval = setInterval(() => {
        refreshSelectedServerClockHealth(true).catch(err => {
            console.error('[API] Kontrola zegara serwera:', err);
            handleVisibleModeApiError(err);
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

const REGIONAL_RECORDED_STATION_DIRECTORY = path.join(__dirname, 'zapowiedzi', 'nazwy stacji p. regio');
const REGIONAL_RECORDED_PHRASE_CONFIGS = Object.freeze({
    pl: Object.freeze({ directory: 'Regio zapowiedź PL', prefix: 'r-pl' }),
    en: Object.freeze({ directory: 'Regio zapowiedź EN', prefix: 'r-en' })
});
const REGIONAL_RECORDED_AUDIO_GAP_MS = 700;

function getRegionalRecordedPhrases() {
    const languageCode = currentInterfaceLanguage === 'en' ? 'en' : 'pl';
    const config = REGIONAL_RECORDED_PHRASE_CONFIGS[languageCode];
    const directory = path.join(__dirname, 'zapowiedzi', config.directory);

    return {
        nextStation: path.join(directory, `${config.prefix}-następna-stacja.mp3`),
        destinationStation: path.join(directory, `${config.prefix}-stacja-docelowa.mp3`),
        station: path.join(directory, `${config.prefix}-stacja.mp3`)
    };
}

function normalizeRegionalRecordingKey(value) {
    return String(value || '')
        .normalize('NFKD')
        .toLocaleLowerCase('pl-PL')
        .replace(/ł/g, 'l')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildRegionalStationRecordingIndex() {
    const index = new Map();

    try {
        if (!fs.existsSync(REGIONAL_RECORDED_STATION_DIRECTORY)) {
            console.warn('[LEKTOR REGIONALNY] Brak folderu z nazwami stacji:', REGIONAL_RECORDED_STATION_DIRECTORY);
            return index;
        }

        fs.readdirSync(REGIONAL_RECORDED_STATION_DIRECTORY, { withFileTypes: true })
            .filter(entry => entry.isFile() && /^r-.+\.mp3$/i.test(entry.name))
            .forEach(entry => {
                const stationNameFromFile = entry.name.replace(/^r-/i, '').replace(/\.mp3$/i, '');
                const normalizedName = normalizeRegionalRecordingKey(stationNameFromFile);

                if (normalizedName && !index.has(normalizedName)) {
                    index.set(normalizedName, path.join(REGIONAL_RECORDED_STATION_DIRECTORY, entry.name));
                }
            });

        console.log(`[LEKTOR REGIONALNY] Wczytano ${index.size} nagrań nazw stacji.`);
    } catch (err) {
        console.error('[LEKTOR REGIONALNY] Nie udało się wczytać nagrań nazw stacji:', err);
    }

    return index;
}

const regionalStationRecordingIndex = buildRegionalStationRecordingIndex();

function getRegionalStationRecordingPath(stationName) {
    return regionalStationRecordingIndex.get(normalizeRegionalRecordingKey(stationName)) || null;
}

function playGongAudio() {
    return new Promise((resolve) => {
        const gong = new Audio('gong.mp3');
        gong.volume = currentTtsVolume;
        activeAudioElements.push(gong);

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            activeAudioElements = activeAudioElements.filter(audio => audio !== gong);
            clearTimeout(timeout);
            resolve();
        };

        const timeout = setTimeout(() => {
            console.error('Timeout awaryjny odtwarzania gongu.');
            finish();
        }, 5000);

        gong.onended = finish;
        gong.onerror = (err) => {
            console.error('Błąd odtwarzania gongu:', err);
            finish();
        };

        gong.play().catch((err) => {
            console.error('gong.play() error:', err);
            finish();
        });
    });
}

function playAudioUrl(audioUrl, { label = 'audio', tickerText = '', revokeUrl = false } = {}) {
    return new Promise((resolve, reject) => {
        const audio = new Audio(audioUrl);
        audio.volume = currentTtsVolume;
        activeAudioElements.push(audio);

        let finished = false;
        let tickerToken = null;

        const cleanup = (err = null) => {
            if (finished) return;
            finished = true;

            activeAudioElements = activeAudioElements.filter(item => item !== audio);
            clearTimeout(timeout);
            hideStationAnnouncementTicker(tickerToken);

            try {
                audio.pause();
                audio.removeAttribute('src');
                audio.load();
            } catch (cleanupError) {}

            if (revokeUrl) URL.revokeObjectURL(audioUrl);
            if (err) reject(err);
            else resolve();
        };

        const timeout = setTimeout(() => {
            cleanup(new Error(`Timeout awaryjny odtwarzania: ${label}`));
        }, 60000);

        audio.onended = () => cleanup();
        audio.onerror = () => cleanup(new Error(`Nie udało się odtworzyć: ${label}`));

        if (tickerText) {
            audio.addEventListener('playing', () => {
                tickerToken = showStationAnnouncementTicker(tickerText, audio.duration);
            }, { once: true });
        }

        audio.play().catch(err => cleanup(err));
    });
}

async function playGeneratedTts(text, voice) {
    // TTS jest generowany w procesie głównym Electron. main.js zwraca MP3
    // jako Base64, dzięki czemu nie przekazujemy ścieżki do pliku tymczasowego.
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

    await playAudioUrl(audioUrl, {
        label: 'TTS',
        tickerText: text,
        revokeUrl: true
    });
}

async function playRecordedAudioFiles(audioFiles) {
    for (let index = 0; index < audioFiles.length; index++) {
        const audioFile = audioFiles[index];
        await playAudioUrl(pathToFileURL(audioFile).href, {
            label: path.basename(audioFile)
        });

        if (index < audioFiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, REGIONAL_RECORDED_AUDIO_GAP_MS));
        }
    }
}

async function processAudioQueue() {
    if (isPlayingAudio || audioQueue.length === 0) return;
    isPlayingAudio = true;

    const queueItem = audioQueue.shift();
    const { text, voice, withGong } = queueItem;

    try {
        if (withGong) await playGongAudio();

        if (queueItem.kind === ANNOUNCEMENT_MODE_RECORDED) {
            try {
                await playRecordedAudioFiles(queueItem.audioFiles);
            } catch (recordedAudioError) {
                console.error('[LEKTOR REGIONALNY] Błąd nagrania. Używam syntezatora:', recordedAudioError);
                await playGeneratedTts(queueItem.fallbackText, queueItem.fallbackVoice);
            }
        } else {
            await playGeneratedTts(text, voice);
        }
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

function queueRegionalRecordedAnnouncement(audioFiles, fallbackText, fallbackVoice) {
    const missingFile = audioFiles.find(audioFile => !audioFile || !fs.existsSync(audioFile));

    if (missingFile !== undefined) {
        console.warn(
            '[LEKTOR REGIONALNY] Brak kompletnego zestawu nagrań. Używam syntezatora:',
            missingFile || 'nieznana nazwa stacji'
        );
        speakText(fallbackText, fallbackVoice);
        return false;
    }

    audioQueue.push({
        kind: ANNOUNCEMENT_MODE_RECORDED,
        audioFiles,
        fallbackText,
        fallbackVoice,
        text: fallbackText,
        voice: fallbackVoice,
        withGong: false
    });
    processAudioQueue();
    return true;
}

function announceRegionalNextStation(nextStation, destinationStation, voice) {
    const fallbackText = `Następna stacja. ${nextStation}. Stacja docelowa. ${destinationStation}.`;

    if (!shouldUseRegionalRecordedAnnouncements()) {
        speakText(fallbackText, voice);
        return;
    }

    const recordedPhrases = getRegionalRecordedPhrases();
    queueRegionalRecordedAnnouncement([
        recordedPhrases.nextStation,
        getRegionalStationRecordingPath(nextStation),
        recordedPhrases.destinationStation,
        getRegionalStationRecordingPath(destinationStation)
    ], fallbackText, voice);
}

function announceRegionalStation(stationName, voice) {
    const fallbackText = `Stacja. ${stationName}.`;

    if (!shouldUseRegionalRecordedAnnouncements()) {
        speakText(fallbackText, voice);
        return;
    }

    const recordedPhrases = getRegionalRecordedPhrases();
    queueRegionalRecordedAnnouncement([
        recordedPhrases.station,
        getRegionalStationRecordingPath(stationName)
    ], fallbackText, voice);
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
            setApiHealthStatus('error', 'api.noResponse');
            throw makeApiError(`${label}: przekroczono ${API_REQUEST_TIMEOUT_MS / 1000}s oczekiwania na odpowiedź API.`, 'API_TIMEOUT');
        }

        if (err?.code !== 'STALE_API_DATA') {
            setApiHealthStatus('error', 'api.connectionError');
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
let trackingGeneration = 0;
let boardRefreshInterval = null;
let countdownInterval = null;
let refreshCountdown = 15;

let allPassengerTrains = []; 
let activeJourneyId = '';
let activeTrainNumber = '';
let activeTrainDisplayName = '';
let activeDestination = ''; 
let activeTrainType = ''; 
let targetStationList = [];
let onboardLastKnownPosition = null;
let onboardLastDisplayedProgressRatio = 0;

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
        ? uiText('setup.removeFavoriteServer')
        : uiText('setup.addFavoriteServer');
}

function updateFavoriteStationButton() {
    const stationName = stationSelect.value;
    const isFavorite = Boolean(stationName) && favoriteStationNames.has(stationName);
    favoriteStationBtn.disabled = stationSelect.disabled || !stationName;
    favoriteStationBtn.textContent = isFavorite ? '★' : '☆';
    favoriteStationBtn.classList.toggle('is-favorite', isFavorite);
    favoriteStationBtn.title = isFavorite
        ? uiText('setup.removeFavoriteStation')
        : uiText('setup.addFavoriteStation');
}

function renderServerOptions(selectedCode = serverSelect.value) {
    serverSelect.innerHTML = `<option value="" data-i18n="setup.selectServer">${uiText('setup.selectServer')}</option>`;

    [...availableServers]
        .sort((a, b) => {
            const favoriteDifference = Number(favoriteServerCodes.has(b.code)) - Number(favoriteServerCodes.has(a.code));
            return favoriteDifference || a.code.localeCompare(b.code);
        })
        .forEach(srv => {
            const opt = document.createElement('option');
            opt.value = srv.code;
            opt.textContent = `${favoriteServerCodes.has(srv.code) ? '★ ' : ''}${uiText('setup.activeServer', { code: srv.code.toUpperCase() })}`;
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
        opt.textContent = uiText('setup.noStations');
        opt.dataset.i18n = 'setup.noStations';
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
        setApiHealthStatus('checking', 'api.checkingAvailability');
        serverSelect.innerHTML = `<option value="" data-i18n="common.loading">${uiText('common.loading')}</option>`;
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
        setLocalizedPlaceholder(trainSearch, 'setup.selectServerFirst');
        trainSearch.disabled = true;
        trainTypeFilter.disabled = true;
        trainSelect.innerHTML = `<option value="" data-i18n="setup.selectServerFirst">${uiText('setup.selectServerFirst')}</option>`;
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

        setApiHealthStatus('ok', 'api.availableSelect');
        refreshServersBtn.disabled = false;
    } catch (err) {
        console.error('[API] Nie udało się pobrać listy serwerów:', err);
        serverSelect.innerHTML = `<option value="" data-i18n="setup.apiError">${uiText('setup.apiError')}</option>`;
        modeSelectionDiv.classList.add('disabled');
        stationSelect.disabled = true;
        stationSearchInput.disabled = true;
        startBtn.disabled = true;
        refreshServersBtn.disabled = false;
        setApiHealthStatus('error', 'api.unavailable');
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
        setApiHealthStatus('ok', 'api.availableSelect');
        updateFavoriteStationButton();
        return;
    }

    const sData = serversMap[serverSelect.value];
    activeServerCode = serverSelect.value;
    currentServerId = sData.id;
    activeServerPcToServerDelta = sData.pcToServerDelta;

    selectedServerClockProblem = null;
    liveSnapshotStateByServer.delete(activeServerCode);
    setApiHealthStatus('checking', 'api.checkingCode', { code: activeServerCode.toUpperCase() });

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
            ? uiText('trains.staleReason')
            : uiText('trains.connectionReason');

        const reasonKey = err?.code === 'STALE_API_DATA' ? 'trains.staleReason' : 'trains.connectionReason';
        trainSelect.innerHTML = `<option value="" data-i18n="${reasonKey}">${reason}</option>`;
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
        trackingGeneration++;
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
        resetOnboardRouteProgress();
        const tbody = document.getElementById('station-departures-body');
        if(tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px;">${uiText('station.stopped')}</td></tr>`;
        hideStationAnnouncementTicker();
        hideApiWarnings();
        setModeRefreshButtonBusy(onboardDataRefreshBtn, false);
        setModeRefreshButtonBusy(stationDataRefreshBtn, false);
        document.getElementById('departed-modal').style.display = 'none';
        document.getElementById('cancelled-modal').style.display = 'none';
        closeSettingsModal();
        if (whatsNewModal && !whatsNewModal.classList.contains('hidden')) closeWhatsNewModal();
        
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
        list.innerHTML = `<li>${uiText('history.noDispatched')}</li>`;
        return;
    }

    departedHistory.forEach(t => {
        const mins = Math.floor((now - t.departedAt) / 60000);
        const li = document.createElement('li');
        li.innerHTML = `<strong>${t.time} ${t.trainName}</strong> ${uiText('history.toStation', { station: t.destination })}<br><span style="color:#ffcc00">${uiText('history.departedMinutes', { minutes: mins })}</span>`;
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
        list.innerHTML = `<li>${uiText('history.noCancelled')}</li>`;
        return;
    }

    cancelledHistory.forEach(t => {
        const mins = Math.max(0, Math.floor((now - t.cancelledAt) / 60000));
        const li = document.createElement('li');
        li.innerHTML = `<strong>${t.time} ${t.trainName}</strong> ${uiText('history.toStation', { station: t.destination })}<br><span style="color:#ff4444">${uiText('history.cancelledMinutes', { minutes: mins })}</span>`;
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
    const hasLka = labels.some(label => containsTrainCategory(label, 'ŁKA'));

    if (hasEip || hasMpe || isEijPendolino(type, ...labels)) return true;
    if (hasLs || hasLka || isEijRegionalLka(type, ...labels)) return false;

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
    if (!headerRow) return;

    headerRow.innerHTML = `
        <th style="width: 120px;">${uiText('station.headerTime')}</th>
        <th style="width: 230px;">${uiText('station.headerTrain')}</th>
        <th>${uiText('station.headerDestination')}</th>
        <th style="width: 90px; text-align: center;">${uiText('station.headerPlatform')}</th>
        <th style="width: 90px; text-align: center;">${uiText('station.headerTrack')}</th>
        <th style="width: 230px; text-align: right;">${uiText('station.headerStatus')}</th>
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
    setModeApiWarning('station', false);
    setModeRefreshButtonBusy(stationDataRefreshBtn, true);
    scheduleRandomStationAnnouncement();
    departedHistory = [];
    cancelledHistory = [];
    document.querySelector('.plk-station-name').textContent = uiText('station.stationNamed', { station: activeStationName });

    document.querySelectorAll('.refresh-countdown').forEach(el => el.style.display = 'block');
    refreshCountdown = 15;
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        refreshCountdown--;
        if (refreshCountdown <= 0) refreshCountdown = 15;
        document.querySelectorAll('.refresh-countdown').forEach(el => el.textContent = uiText('station.refreshCountdown', { seconds: refreshCountdown }));
    }, 1000);

    await fetchStationTimetable();
    if (stationScreen.style.display !== 'none') startStationLiveTracking();
    setModeRefreshButtonBusy(stationDataRefreshBtn, false);

    if (boardRefreshInterval) clearInterval(boardRefreshInterval);
    boardRefreshInterval = setInterval(() => {
        if (!isSyncing) renderStationBoard();
    }, 30000);
}

async function fetchStationTimetable() {
    const tbody = document.getElementById('station-departures-body');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #ffcc00;">${uiText('station.loadingFullSchedule')}</td></tr>`;

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

        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #ffcc00;">${uiText('station.scanningMap')}<br><small style="color:#aaa;">${uiText('station.detectedActive', { count: globalActiveTrainsCount })}</small></td></tr>`;

        await syncNewTrains(activeTrains);
        renderStationBoard();
        return true;
    } catch (err) {
        console.error('[STACJA] Błąd pobierania rozkładu:', err);
        handleVisibleModeApiError(err);
        if (stationTimetable.length > 0) {
            renderStationBoard();
        } else {
            const text = uiText('station.noData');
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:#ff5252;">${text}</td></tr>`;
        }
        return false;
    }
}

async function refreshStationModeData() {
    if (!stationDataRefreshBtn || stationDataRefreshBtn.disabled) return;

    const previousTimetable = stationTimetable;
    const previousKnownJourneyIds = knownJourneyIds;

    setModeRefreshButtonBusy(stationDataRefreshBtn, true);
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
    trackingGeneration++;

    // Jeżeli poprzedni cykl właśnie dodaje nowe pociągi, pozwalamy mu bezpiecznie
    // zakończyć zapis przed zastąpieniem listy świeżym rozkładem.
    for (let attempt = 0; attempt < 200 && isSyncing; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
        try {
            await refreshSelectedServerClockHealth(true);
        } catch (err) {
            handleVisibleModeApiError(err);
        }

        const refreshed = await fetchStationTimetable();

        if (!refreshed && previousTimetable.length > 0) {
            stationTimetable = previousTimetable;
            knownJourneyIds = previousKnownJourneyIds;
            renderStationBoard();
        }
    } catch (err) {
        console.error('[STACJA] Ręczne odświeżenie danych nie powiodło się:', err);
        handleVisibleModeApiError(err);
        stationTimetable = previousTimetable;
        knownJourneyIds = previousKnownJourneyIds;
        if (stationTimetable.length > 0) renderStationBoard();
    } finally {
        refreshCountdown = 15;
        if (stationScreen.style.display !== 'none') startStationLiveTracking();
        setModeRefreshButtonBusy(stationDataRefreshBtn, false);
    }
}

stationDataRefreshBtn?.addEventListener('click', refreshStationModeData);

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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #8899aa;">${uiText('station.emptyBoard')}<br><br><span style="font-size: 0.8em; opacity: 0.6;">${uiText('station.activeOnServer', { count: globalActiveTrainsCount })}</span></td></tr>`;
        return;
    }

    displayList.forEach(t => {
        const tr = document.createElement('tr');

        let typeStr = uiText('station.typeRegional');
        if (isEijPendolino(t.trainTypeRaw, t.trainCategory, t.trainName)) typeStr = uiText('station.typeExpressPremium');
        else if (isEijRegionalLka(t.trainTypeRaw, t.trainCategory, t.trainName)) typeStr = uiText('station.typeLkaExpress');
        else if (t.trainCategory.includes('EIP') || t.trainName.includes('EIP')) typeStr = uiText('station.typeLongDistance');
        else if (t.trainCategory.includes('Łs') || t.trainName.includes('Łs')) typeStr = uiText('station.typeFastPassenger');
        else if (t.trainCategory.includes('MPE')) typeStr = uiText('station.typeTlk');
        else if (LONG_DISTANCE_EXPRESS_TYPES.has(t.trainTypeRaw)) typeStr = uiText('station.typeLongDistance');
        else if (t.trainCategory.includes('ŁKA')) typeStr = uiText('station.typeSprinter');

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
                <div style="color: #ccc;"><small style="opacity:0.7">${uiText('station.arrivalShort')} </small>${arrHtml}</div>
                <div style="color: #fff;"><small style="opacity:0.7">${uiText('station.departureShort')} </small>${depHtml}</div>
            </div>`;
        } else {
            timeHtml = `<div style="line-height: 1.3; font-size: 0.9em;"><small style="opacity:0.7">${uiText('station.departureShort')} </small>${depHtml}</div>`;
        }

        let statusHtml = '';

        if (t.cancelled) {
            statusHtml = `<span style="color:#ff4444;">${uiText('station.statusCancelled')}</span>`;
        } else if (!t.seenOnMap) {
            statusHtml = `<span style="color:#aaccff;">${uiText('station.statusScheduled')}</span>`;
        } else if (t.gpsStatus === 'Odjechał' || (t.gpsStatus !== 'Na stacji' && now > t.actualDepTime + STATION_DEPARTURE_FALLBACK_MS)) {
            statusHtml = `<span style="color:#aaccff;">${uiText('station.statusDeparted')}</span>`;
        } else if (t.gpsStatus === 'Na stacji') {
            statusHtml = `<span style="color:#00e676;">${uiText('station.statusAtStation')}</span>`;
        } else if (t.delayMin > 0) {
            statusHtml = `<span style="color:#ff4444;">${uiText('station.statusDelayed', { minutes: t.delayMin })}</span>`;
        } else {
            statusHtml = `<span style="color:#ffcc00;">${uiText('station.statusOnTime')}</span>`;
        }

        const platformDisplay = t.platform || '—';
        const trackDisplay = t.track || '—';

        tr.innerHTML = `
            <td>${timeHtml}</td>
            <td><div class="plk-train-name">${t.trainName}</div><span class="plk-train-type">${typeStr}</span></td>
            <td><div class="plk-dest">${t.destination}</div>${t.viaText ? `<span class="plk-via">${uiText('station.via', { via: t.viaText })}</span>` : ''}</td>
            <td style="text-align: center; font-weight: bold; font-size: 28px; color: #ffcc00;">${platformDisplay}</td>
            <td style="text-align: center; font-weight: bold; font-size: 28px; color: #ffcc00;">${trackDisplay}</td>
            <td style="text-align: right; font-weight: bold; font-size: 24px;">${statusHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function startStationLiveTracking() {
    if (trackingInterval) clearInterval(trackingInterval);
    const modeTrackingGeneration = ++trackingGeneration;
    const stationVoice = 'pl-PL-ZofiaNeural';

    trackingInterval = setInterval(async () => {
        if (modeTrackingGeneration !== trackingGeneration) return;
        refreshCountdown = 15;

        try {
            const now = getSimNow();
            const activeTrains = await fetchJsonFresh(
                `${API_BASE}/sit-journeys/v2/active?serverId=${currentServerId}`,
                'Live tracking - stacja'
            );

            if (modeTrackingGeneration !== trackingGeneration) return;

            syncTimeWithActiveTrains(activeTrains);
            globalActiveTrainsCount = Array.isArray(activeTrains) ? activeTrains.length : 0;

            // Poczekaj na dodanie nowych pociągów, żeby mogły zostać uwzględnione
            // jeszcze w tym samym cyklu odświeżenia.
            await syncNewTrains(activeTrains);
            if (modeTrackingGeneration !== trackingGeneration) return;

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
            if (modeTrackingGeneration !== trackingGeneration) return;

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
            handleVisibleModeApiError(err);

            // Zachowujemy ostatnią poprawnie wyrenderowaną tablicę. Ostrzeżenie
            // jasno informuje, że widoczne godziny i statusy mogą być nieaktualne.
            if (!isSyncing && stationTimetable.length > 0) renderStationBoard();
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
        setLocalizedPlaceholder(trainSearch, 'trains.loading');
        trainSearch.disabled = true;
        trainTypeFilter.disabled = true;
        trainSelect.innerHTML = `<option value="" data-i18n="trains.loadingShort">${uiText('trains.loadingShort')}</option>`;
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
            setLocalizedPlaceholder(trainSearch, 'trains.noneOnServer');
            trainSelect.innerHTML = `<option value="" data-i18n="trains.none">${uiText('trains.none')}</option>`;
            refreshTrainsBtn.disabled = false;
            return;
        }

        const passengerTrains = trains.filter(isPassengerActiveTrain);

        if (passengerTrains.length === 0) {
            setLocalizedPlaceholder(trainSearch, 'trains.nonePassenger');
            trainSelect.innerHTML = `<option value="" data-i18n="trains.none">${uiText('trains.none')}</option>`;
            refreshTrainsBtn.disabled = false;
            return;
        }

        passengerTrains.forEach(t => {
            const category = t.originEvent?.transport?.category || 'POC';
            const number = t.originEvent?.transport?.number || '0';
            const destination = t.destinationEvent?.stopPlace?.name || '?';
            
            allPassengerTrains.push({
                journeyId: t.journeyId,
                label: `${category} ${number} ${destination}`,
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
        setLocalizedPlaceholder(trainSearch, 'trains.search');
        
        renderTrainOptions(); 
    } catch (err) {
        console.error('[MASZYNISTA] Błąd pobierania listy pociągów:', err);
        setLocalizedPlaceholder(trainSearch, err?.code === 'STALE_API_DATA' ? 'trains.apiStale' : 'trains.apiError');
        const optionKey = err?.code === 'STALE_API_DATA' ? 'trains.staleOption' : 'trains.noConnection';
        trainSelect.innerHTML = `<option value="" data-i18n="${optionKey}">${uiText(optionKey)}</option>`;
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
    const selectedJourneyId = trainSelect.value;
    trainSelect.innerHTML = '';
    const lowerFilter = filterText.toLowerCase();
    const typeFilter = trainTypeFilter.value; 

    const filteredTrains = allPassengerTrains.filter(t => {
        const searchableLabel = `${t.trainInfo} ${t.destination}`.toLowerCase();
        if (!searchableLabel.includes(lowerFilter)) return false;
        const info = t.trainInfo.toUpperCase();
        
        const isExpress = isExpressTrainForUi(t.type, info);

        if (typeFilter === 'EXPRESS' && !isExpress) return false;
        if (typeFilter === 'REGIONAL' && isExpress) return false;
        return true;
    });

    if (filteredTrains.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = uiText('trains.noMatches');
        opt.dataset.i18n = 'trains.noMatches';
        opt.disabled = true;
        trainSelect.appendChild(opt);
    } else {
        filteredTrains.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.journeyId;
            opt.textContent = uiText('trains.option', {
                train: t.trainInfo,
                destination: t.destination
            });
            opt.dataset.trainInfo = t.trainInfo;
            opt.dataset.destination = t.destination;
            opt.dataset.type = t.type;
            opt.dataset.rawNumber = t.rawNumber;
            if (t.journeyId === selectedJourneyId) opt.selected = true;
            trainSelect.appendChild(opt);
        });
    }
}

function updateSpeedOnboard(newSpeed) {
    const speedElement = document.querySelector('.speed-value');
    if (speedElement) speedElement.textContent = Math.round(newSpeed);
}

function isValidOnboardPosition(position) {
    return Number.isFinite(position?.lat) &&
        Number.isFinite(position?.lon) &&
        (position.lat !== 0 || position.lon !== 0);
}

function getOnboardRouteDistanceSummary(routeArray) {
    const cumulativeDistances = [0];
    let totalDistance = 0;

    for (let index = 1; index < routeArray.length; index++) {
        const previousStop = routeArray[index - 1];
        const currentStop = routeArray[index];
        const segmentDistance = getDistanceFromLatLonInMeters(
            previousStop.lat,
            previousStop.lon,
            currentStop.lat,
            currentStop.lon
        );

        totalDistance += Number.isFinite(segmentDistance) ? Math.max(0, segmentDistance) : 0;
        cumulativeDistances.push(totalDistance);
    }

    return { cumulativeDistances, totalDistance };
}

function updateOnboardRouteProgress(routeArray, position = onboardLastKnownPosition) {
    const progressContainer = document.getElementById('route-progress');
    if (!progressContainer) return;

    const percentElement = progressContainer.querySelector('.route-progress__percent');
    const originElement = progressContainer.querySelector('.route-progress__origin');
    const destinationElement = progressContainer.querySelector('.route-progress__destination');
    const trackElement = progressContainer.querySelector('.route-progress__track');
    const fillElement = progressContainer.querySelector('.route-progress__fill');
    const markerElement = progressContainer.querySelector('.route-progress__marker');
    const statusElement = progressContainer.querySelector('.route-progress__status');
    const stageElement = progressContainer.querySelector('.route-progress__stage');

    if (!Array.isArray(routeArray) || routeArray.length === 0) {
        onboardLastDisplayedProgressRatio = 0;
        percentElement.textContent = '0%';
        originElement.textContent = '---';
        destinationElement.textContent = '---';
        fillElement.style.width = '0%';
        markerElement.style.left = '0%';
        trackElement.setAttribute('aria-valuenow', '0');
        statusElement.textContent = uiText('route.waiting');
        stageElement.textContent = uiText('route.zeroStations');
        progressContainer.setAttribute('aria-label', uiText('route.progressWaitingAria'));
        return;
    }

    const activeIndexFromState = routeArray.findIndex(stop => stop.current);
    const activeIndex = activeIndexFromState >= 0 ? activeIndexFromState : 0;
    const activeStop = routeArray[activeIndex];
    const lastIndex = routeArray.length - 1;
    const { cumulativeDistances, totalDistance } = getOnboardRouteDistanceSummary(routeArray);
    let progressRatio = 0;

    if (lastIndex === 0) {
        progressRatio = activeStop.state === 'at-station' ? 1 : 0;
    } else if (totalDistance > 0) {
        if (activeStop.state === 'at-station') {
            progressRatio = cumulativeDistances[activeIndex] / totalDistance;
        } else if (activeIndex > 0) {
            const previousStop = routeArray[activeIndex - 1];
            const segmentDistance = cumulativeDistances[activeIndex] - cumulativeDistances[activeIndex - 1];
            let segmentProgress = 0;

            if (isValidOnboardPosition(position)) {
                const distanceFromPrevious = getDistanceFromLatLonInMeters(
                    position.lat,
                    position.lon,
                    previousStop.lat,
                    previousStop.lon
                );
                const distanceToTarget = getDistanceFromLatLonInMeters(
                    position.lat,
                    position.lon,
                    activeStop.lat,
                    activeStop.lon
                );
                const distanceSum = distanceFromPrevious + distanceToTarget;
                if (Number.isFinite(distanceSum) && distanceSum > 0) {
                    segmentProgress = distanceFromPrevious / distanceSum;
                }
            }

            const coveredDistance = cumulativeDistances[activeIndex - 1] +
                segmentDistance * Math.max(0, Math.min(1, segmentProgress));
            progressRatio = coveredDistance / totalDistance;
        }
    } else {
        progressRatio = activeStop.state === 'at-station'
            ? activeIndex / lastIndex
            : Math.max(0, activeIndex - 1) / lastIndex;
    }

    progressRatio = Math.max(onboardLastDisplayedProgressRatio, Math.max(0, Math.min(1, progressRatio)));
    onboardLastDisplayedProgressRatio = progressRatio;
    const progressPercent = Math.round(progressRatio * 100);
    const progressPosition = `${(progressRatio * 100).toFixed(1)}%`;
    const originName = routeArray[0].station || uiText('route.originFallback');
    const destinationName = routeArray[lastIndex].station || activeDestination || uiText('route.destinationFallback');
    const isAtStation = activeStop.state === 'at-station';
    const statusText = isAtStation
        ? uiText('route.atStation', { station: activeStop.station })
        : activeIndex === 0
            ? uiText('route.routeStart', { station: activeStop.station })
            : uiText('route.toStation', { station: activeStop.station });
    const stageText = isAtStation
        ? uiText('route.stationStage', { current: activeIndex + 1, total: routeArray.length })
        : activeIndex === 0
            ? uiText('route.stationStage', { current: 1, total: routeArray.length })
            : uiText('route.segmentStage', { current: activeIndex, total: lastIndex });

    percentElement.textContent = `${progressPercent}%`;
    originElement.textContent = originName;
    originElement.title = originName;
    destinationElement.textContent = destinationName;
    destinationElement.title = destinationName;
    fillElement.style.width = progressPosition;
    markerElement.style.left = progressPosition;
    trackElement.setAttribute('aria-valuenow', String(progressPercent));
    statusElement.textContent = statusText;
    statusElement.title = statusText;
    stageElement.textContent = stageText;
    progressContainer.setAttribute('aria-label', uiText('route.progressValueAria', {
        percent: progressPercent,
        status: statusText
    }));
}

function resetOnboardRouteProgress() {
    onboardLastKnownPosition = null;
    onboardLastDisplayedProgressRatio = 0;
    updateOnboardRouteProgress([]);
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
    updateOnboardRouteProgress(routeArray);
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
    resetOnboardRouteProgress();
    activeJourneyId = trainSelect.value;
    const selectedOption = trainSelect.options[trainSelect.selectedIndex];
    activeTrainNumber = selectedOption.dataset.rawNumber || '';
    activeTrainDisplayName = selectedOption.dataset.trainInfo || '';
    
    activeDestination = selectedOption.dataset.destination;
    
    const trainInfoText = selectedOption.dataset.trainInfo.toUpperCase();
    if (isExpressTrainForUi(selectedOption.dataset.type, trainInfoText)) {
        activeTrainType = "NATIONAL_EXPRESS_TRAIN";
    } else {
        activeTrainType = "REGIONAL_TRAIN";
    }

    setupScreen.style.display = 'none';
    sipScreen.style.display = 'flex';
    setModeApiWarning('onboard', false);
    setModeRefreshButtonBusy(onboardDataRefreshBtn, true);
    document.querySelector('.train-info').textContent = uiText('onboard.direction', {
        train: activeTrainDisplayName,
        destination: activeDestination
    });
    document.querySelector('.current-status .label').textContent = uiText('onboard.nextStation');
    document.querySelector('.eta-box .label').textContent = uiText('onboard.plannedArrival');

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
        handleVisibleModeApiError(err);
    }

    await loadJourneyRouteOnboard(
        activeJourneyId,
        initialLat,
        initialLon,
        activeTrainNumber
    );
    if (sipScreen.style.display !== 'none') startOnboardLiveTracking();
    setModeRefreshButtonBusy(onboardDataRefreshBtn, false);
}

async function refreshOnboardModeData() {
    if (!onboardDataRefreshBtn || onboardDataRefreshBtn.disabled) return;

    setModeRefreshButtonBusy(onboardDataRefreshBtn, true);
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
    trackingGeneration++;

    try {
        try {
            await refreshSelectedServerClockHealth(true);
        } catch (err) {
            handleVisibleModeApiError(err);
        }

        const trains = await fetchJsonFresh(
            `${API_BASE}/sit-journeys/v2/active?serverId=${currentServerId}`,
            'Ręczne odświeżenie - maszynista'
        );

        syncTimeWithActiveTrains(trains);

        const myTrain = trains.find(t => t.journeyId === activeJourneyId);
        if (!myTrain) {
            throw makeApiError('Wybrany pociąg nie jest już dostępny na mapie.', 'TRAIN_NOT_FOUND');
        }

        const position = myTrain.liveData?.position;
        const routeLoaded = await loadJourneyRouteOnboard(
            activeJourneyId,
            position?.latitude || 0,
            position?.longitude || 0,
            activeTrainNumber
        );

        if (routeLoaded && myTrain.liveData) updateSpeedOnboard(myTrain.liveData.speed);
    } catch (err) {
        console.error('[MASZYNISTA] Ręczne odświeżenie danych nie powiodło się:', err);
        handleVisibleModeApiError(err);
    } finally {
        if (sipScreen.style.display !== 'none') startOnboardLiveTracking();
        setModeRefreshButtonBusy(onboardDataRefreshBtn, false);
    }
}

onboardDataRefreshBtn?.addEventListener('click', refreshOnboardModeData);

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
        
        if (Number.isFinite(trainLat) && Number.isFinite(trainLon) && (trainLat !== 0 || trainLon !== 0)) {
            onboardLastKnownPosition = { lat: trainLat, lon: trainLon };
        }

        renderRouteUIOnboard(targetStationList);
        setTimeout(() => {
            const activeElement = document.querySelector('.route-list li.approaching') || document.querySelector('.route-list li.at-station');
            if (activeElement) activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
        return true;
    } catch(err) {
        console.error('[MASZYNISTA] Błąd wczytywania trasy pociągu:', err);
        handleVisibleModeApiError(err);
        return false;
    }
}

function startOnboardLiveTracking() {
    if (trackingInterval) clearInterval(trackingInterval);
    const modeTrackingGeneration = ++trackingGeneration;
    const currentIsIntercity = ["NATIONAL_EXPRESS_TRAIN", "INTER_NATIONAL_EXPRESS_TRAIN", "INTER_REGIONAL_EXPRESS_TRAIN"].includes(activeTrainType);
    const currentHasWars = ["NATIONAL_EXPRESS_TRAIN", "INTER_NATIONAL_EXPRESS_TRAIN"].includes(activeTrainType);
    const assignedVoice = currentIsIntercity ? 'pl-PL-ZofiaNeural' : 'pl-PL-MarekNeural';
    let missingTrainCount = 0;
    let trackingLoopCounter = 0;

    trackingInterval = setInterval(async () => {
        if (modeTrackingGeneration !== trackingGeneration) return;
        trackingLoopCounter++;
        try {
            const trains = await fetchJsonFresh(
                `${API_BASE}/sit-journeys/v2/active?serverId=${currentServerId}`,
                'Live tracking - maszynista'
            );

            if (modeTrackingGeneration !== trackingGeneration) return;
            
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
                    if (modeTrackingGeneration !== trackingGeneration) return;
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
                    handleVisibleModeApiError(e);
                }
            }

            updateSpeedOnboard(myTrain.liveData.speed);
            const currentLat = myTrain.liveData.position.latitude;
            const currentLon = myTrain.liveData.position.longitude;
            onboardLastKnownPosition = { lat: currentLat, lon: currentLon };
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
                    if (currentIsIntercity) {
                        speakText(`Witamy Państwa na pokładzie pociągu intercity do stacji ${activeDestination}. Następna stacja ${targetStation.station}.`, assignedVoice);
                    } else {
                        announceRegionalNextStation(targetStation.station, activeDestination, assignedVoice);
                    }
                }
                if (currentHasWars && distFromPrev >= 2000 && !targetStation.warsAnnounced && !targetStation.arrivalPlayed) {
                    targetStation.warsAnnounced = true;
                    speakText(`Szanowni Państwo. Zapraszamy do skorzystania ze strefy gastronomicznej wars, która znajduje się w wagonie numer trzy. Udając się do strefy wars prosimy pamiętać o zabraniu biletu oraz dokumentu tożsamości. Dziękujemy.`, assignedVoice);
                }
            }

            if (distMeters <= 700 && !targetStation.arrivalPlayed) {
                targetStation.arrivalPlayed = true;
                targetStation.state = 'at-station';
                document.querySelector('.current-status .label').textContent = uiText('onboard.station');
                document.querySelector('.eta-box .label').textContent = uiText('onboard.plannedDeparture');
                renderRouteUIOnboard(targetStationList);
                if (currentIsIntercity) {
                    speakText(`Szanowni państwo zbliżamy się do stacji ${targetStation.station}. Osoby wysiadające prosimy o zabranie bagażu oraz rzeczy osobistych. Dziękujemy za wspólną podróż i życzymy miłego pobytu.`, assignedVoice);
                } else {
                    announceRegionalStation(targetStation.station, assignedVoice);
                }
            }
            
            if (distMeters > 150 && targetStation.arrivalPlayed && distMeters > targetStation.minDistance + 100) {
                if(targetStationIndex + 1 < targetStationList.length) {
                    const nextStation = targetStationList[targetStationIndex + 1];
                    targetStation.current = false;
                    nextStation.current = true;
                    targetStation.state = 'inactive';
                    nextStation.state = 'approaching';
                    document.querySelector('.current-status .label').textContent = uiText('onboard.nextStation');
                    document.querySelector('.eta-box .label').textContent = uiText('onboard.plannedArrival');
                    renderRouteUIOnboard(targetStationList);
                    const activeElement = document.querySelector('.route-list li.approaching');
                    if (activeElement) activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            updateOnboardRouteProgress(targetStationList, onboardLastKnownPosition);
        } catch (err) {
            console.error('[MASZYNISTA] Błąd pętli live tracking:', err);
            handleVisibleModeApiError(err);
        }
    }, 5000); 
}

function refreshLocalizedInterface() {
    if (whatsNewVersion) {
        whatsNewVersion.textContent = uiText('whatsNew.version', { version: currentAppVersion });
    }

    const apiStatusHint = document.getElementById('api-health-hint');
    if (apiStatusHint) apiStatusHint.textContent = uiText('api.hint');

    const apiStatus = document.getElementById('api-health-status');
    if (apiStatus) renderApiStatusElement(apiStatus);

    setModeApiWarning('station', stationApiWarning ? !stationApiWarning.hidden : false);
    setModeApiWarning('onboard', onboardApiWarning ? !onboardApiWarning.hidden : false);

    updateFavoriteServerButton();
    updateFavoriteStationButton();

    if (availableServers.length > 0) renderServerOptions(serverSelect.value);
    loadStaticStations(stationSearchInput.value);

    if (allPassengerTrains.length > 0 && !trainSelect.disabled) {
        renderTrainOptions(trainSearch.value);
    }

    ensureStationPlatformTrackColumns();

    if (activeStationName) {
        document.querySelector('.plk-station-name').textContent = uiText('station.stationNamed', {
            station: activeStationName
        });
    }

    document.querySelectorAll('.refresh-countdown').forEach(element => {
        element.textContent = uiText('station.refreshCountdown', { seconds: refreshCountdown });
    });

    if (stationScreen.style.display !== 'none') {
        renderStationBoard();
        if (document.getElementById('departed-modal').style.display === 'flex') renderDepartedModal();
        if (document.getElementById('cancelled-modal').style.display === 'flex') renderCancelledModal();
    }

    if (sipScreen.style.display !== 'none') {
        const trainInfo = document.querySelector('.train-info');
        if (trainInfo && activeTrainDisplayName) {
            trainInfo.textContent = uiText('onboard.direction', {
                train: activeTrainDisplayName,
                destination: activeDestination
            });
        }

        const activeStop = targetStationList.find(stop => stop.current);
        const isAtStation = activeStop?.state === 'at-station';
        document.querySelector('.current-status .label').textContent = uiText(
            isAtStation ? 'onboard.station' : 'onboard.nextStation'
        );
        document.querySelector('.eta-box .label').textContent = uiText(
            isAtStation ? 'onboard.plannedDeparture' : 'onboard.plannedArrival'
        );
        renderRouteUIOnboard(targetStationList);
    } else {
        updateOnboardRouteProgress(targetStationList);
    }
}

// Inicjalizacja ładowania serwerów na starcie
setInterfaceLanguage(currentInterfaceLanguage, false);
loadServers();
