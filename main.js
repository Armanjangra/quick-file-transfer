const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 720,
    title: 'Quick File Transfer',
    icon: path.join(__dirname, 'icon.ico'), // Set Window & Taskbar Icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const loadApp = () => {
    mainWindow.loadURL('http://localhost:3000').catch((err) => {
      console.log('Retrying connection to server...');
      setTimeout(loadApp, 500);
    });
  };

  loadApp();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  try {
    require('./server.js');
  } catch (err) {
    dialog.showErrorBox('Server Start Error', err.stack || err.message);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});