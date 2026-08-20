const { app, BrowserWindow, ipcMain, powerSaveBlocker, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const { autoUpdater } = require('electron-updater');

// Zachowane z dotychczasowej wersji projektu.
// Uwaga bezpieczeństwa: globalne wyłączenie weryfikacji certyfikatów TLS nie jest zalecane.
// Na razie pozostawione, aby nie zmieniać działającego mechanizmu TTS.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let mainWindow = null;
let powerBlockerId = null;
let updateCheckInterval = null;
let lastLoggedUpdateProgress = -10;

function getLogPath() {
  return path.join(app.getPath('userData'), 'tts-debug.log');
}

function writeLog(message, error = null) {
  try {
    if (!app.isReady()) return;

    const time = new Date().toISOString();
    let line = `[${time}] ${message}`;

    if (error) {
      line += `\n${error.stack || error.message || String(error)}`;
    }

    line += '\n';
    fs.appendFileSync(getLogPath(), line, 'utf8');
  } catch (logError) {
    console.error('Nie udało się zapisać tts-debug.log:', logError);
  }
}

function getAppIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.ico');
  }

  return path.join(__dirname, 'build', 'icon.ico');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true,
    icon: getAppIconPath(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      // Aplikacja śledzi pociąg co kilka sekund także wtedy, gdy SimRail jest na pierwszym planie.
      // Wyłączenie throttlingu zapobiega ograniczaniu setInterval/fetch po przejściu okna w tło.
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==========================================
// AUTOAKTUALIZACJA - GITHUB RELEASES
// ==========================================
function setupAutoUpdater() {
  // W trybie npm start nie ma pliku app-update.yml.
  // Aktualizacje sprawdzamy wyłącznie w zbudowanej/zainstalowanej aplikacji.
  if (!app.isPackaged) {
    writeLog('Autoaktualizacja pominięta: aplikacja działa w trybie deweloperskim.');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    writeLog(`Sprawdzanie aktualizacji. Aktualna wersja: ${app.getVersion()}`);
  });

  autoUpdater.on('update-available', (info) => {
    lastLoggedUpdateProgress = -10;
    writeLog(`Dostępna aktualizacja: ${info.version}. Rozpoczynam pobieranie w tle.`);
  });

  autoUpdater.on('update-not-available', (info) => {
    writeLog(`Brak nowszej wersji. Najnowsza: ${info.version || app.getVersion()}`);
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.floor(progress.percent || 0);

    // Nie zapisujemy logu przy każdym fragmencie pliku, tylko mniej więcej co 10%.
    if (percent >= lastLoggedUpdateProgress + 10 || percent === 100) {
      lastLoggedUpdateProgress = percent;
      writeLog(`Pobieranie aktualizacji: ${percent}%`);
    }
  });

  autoUpdater.on('update-downloaded', async (info) => {
    writeLog(`Aktualizacja ${info.version} została pobrana.`);

    try {
      const result = await dialog.showMessageBox(mainWindow || undefined, {
        type: 'info',
        title: 'Aktualizacja SimRail SIP by Urso',
        message: `Pobrano nową wersję SimRail SIP by Urso ${info.version}.`,
        detail: 'Czy chcesz teraz zamknąć program i zainstalować aktualizację?',
        buttons: ['Zainstaluj teraz', 'Później'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });

      if (result.response === 0) {
        writeLog(`Użytkownik wybrał instalację aktualizacji ${info.version}.`);

        if (updateCheckInterval) {
          clearInterval(updateCheckInterval);
          updateCheckInterval = null;
        }

        // Krótkie opóźnienie pozwala zamknąć okno dialogowe przed uruchomieniem instalatora.
        setTimeout(() => {
          autoUpdater.quitAndInstall(false, true);
        }, 500);
      } else {
        writeLog(`Instalacja aktualizacji ${info.version} odłożona na później.`);
      }
    } catch (err) {
      writeLog('Błąd podczas wyświetlania okna aktualizacji.', err);
    }
  });

  autoUpdater.on('error', (err) => {
    // Błąd aktualizacji nie może zatrzymywać TTS ani śledzenia pociągów.
    console.error('Błąd autoaktualizacji:', err);
    writeLog('BŁĄD AUTOAKTUALIZACJI', err);
  });

  const checkForUpdatesSafely = async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      console.error('Nie udało się sprawdzić aktualizacji:', err);
      writeLog('Nie udało się sprawdzić aktualizacji.', err);
    }
  };

  // Pierwsze sprawdzenie kilka sekund po uruchomieniu.
  setTimeout(checkForUpdatesSafely, 5000);

  // Jeśli program jest uruchomiony przez wiele godzin, sprawdź ponownie co 4 godziny.
  updateCheckInterval = setInterval(checkForUpdatesSafely, 4 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  writeLog(`Aplikacja uruchomiona. Wersja: ${app.getVersion()}`);

  // Zapewnia prawidłowe grupowanie i ikonę aplikacji na pasku zadań Windows.
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.simrailsip.app');
  }

  // Nie pozwalamy Windows/Electronowi usypiać procesu podczas śledzenia pociągu.
  // Ekran nadal może się normalnie wygasić.
  powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  writeLog(`PowerSaveBlocker uruchomiony: ${powerBlockerId}`);

  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }

  if (
    powerBlockerId !== null &&
    powerSaveBlocker.isStarted(powerBlockerId)
  ) {
    powerSaveBlocker.stop(powerBlockerId);
    powerBlockerId = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==========================================
// TTS W PROCESIE GŁÓWNYM
// ==========================================
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Renderer nie dostaje już ścieżki do pliku TEMP.
// main.js:
// 1. generuje MP3,
// 2. odczytuje MP3 do pamięci,
// 3. usuwa plik tymczasowy,
// 4. zwraca rendererowi audio jako Base64.
ipcMain.handle('generate-tts', async (event, { text, voice }) => {
  let tempFilePath = null;

  try {
    if (typeof text !== 'string' || text.trim() === '') {
      throw new Error('Tekst TTS jest pusty.');
    }

    if (typeof voice !== 'string' || voice.trim() === '') {
      throw new Error('Nie podano głosu TTS.');
    }

    writeLog(`Start TTS | voice=${voice} | text=${text.substring(0, 120)}`);

    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      voice,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );

    const outputFolder = os.tmpdir();
    const result = await tts.toFile(outputFolder, text);
    tempFilePath = result && result.audioFilePath;

    if (!tempFilePath) {
      throw new Error('msedge-tts nie zwrócił ścieżki do wygenerowanego pliku.');
    }

    if (!fs.existsSync(tempFilePath)) {
      throw new Error(`Wygenerowany plik TTS nie istnieje: ${tempFilePath}`);
    }

    const stats = await fs.promises.stat(tempFilePath);
    if (!stats.isFile() || stats.size === 0) {
      throw new Error(`Wygenerowany plik TTS jest pusty lub nieprawidłowy: ${tempFilePath}`);
    }

    const audioBuffer = await fs.promises.readFile(tempFilePath);
    const audioBase64 = audioBuffer.toString('base64');

    writeLog(`TTS OK | bytes=${audioBuffer.length}`);

    return {
      success: true,
      audioBase64,
      mimeType: 'audio/mpeg'
    };
  } catch (err) {
    console.error('Błąd TTS w procesie głównym:', err);
    writeLog('BŁĄD TTS', err);

    return {
      success: false,
      error: err && err.message ? err.message : String(err)
    };
  } finally {
    if (tempFilePath) {
      try {
        await fs.promises.unlink(tempFilePath);
        writeLog(`Usunięto plik tymczasowy: ${tempFilePath}`);
      } catch (unlinkError) {
        // ENOENT oznacza tylko, że pliku już nie ma.
        if (unlinkError && unlinkError.code !== 'ENOENT') {
          writeLog(`Nie udało się usunąć pliku tymczasowego: ${tempFilePath}`, unlinkError);
        }
      }
    }
  }
});

ipcMain.handle('get-tts-log-path', async () => {
  return getLogPath();
});
