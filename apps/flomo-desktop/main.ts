import { app, BrowserWindow, Menu, shell } from 'electron';
import * as path from 'path';
import { ChildProcess, fork } from 'child_process';
import * as net from 'net';
import * as fs from 'fs';

const DEV_URL = 'http://localhost:3000';
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let nextServerProcess: ChildProcess | null = null;
let serverPort = 0;

// Find a free port
function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Failed to get port'));
      }
    });
    server.on('error', reject);
  });
}

// Ensure database exists in userData
function ensureDatabase(): string {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'flomo.db');
  const dbUrl = `file:${dbPath}`;

  // Copy initial database if it doesn't exist
  if (!fs.existsSync(dbPath)) {
    const resourcesPath = process.resourcesPath || path.join(__dirname, '..');
    const sourceDb = path.join(resourcesPath, 'flomo-app', 'prisma', 'dev.db');
    if (fs.existsSync(sourceDb)) {
      fs.copyFileSync(sourceDb, dbPath);
    }
    // If no source DB, Prisma will create it on first access
  }

  return dbUrl;
}

// Start the embedded Next.js server
async function startNextServer(): Promise<string> {
  const port = await getAvailablePort();
  serverPort = port;
  const dbUrl = ensureDatabase();

  const resourcesPath = process.resourcesPath || path.join(__dirname, '..');
  const nextAppDir = path.join(resourcesPath, 'flomo-app');
  const serverScript = path.join(resourcesPath, 'flomo-app', 'next-server.js');

  return new Promise((resolve, reject) => {
    nextServerProcess = fork(serverScript, [], {
      env: {
        ...process.env,
        PORT: String(port),
        NEXT_DIR: nextAppDir,
        DATABASE_URL: dbUrl,
        NODE_ENV: 'production',
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    nextServerProcess.on('message', (msg: { type: string; port: number }) => {
      if (msg.type === 'ready') {
        resolve(`http://127.0.0.1:${msg.port}`);
      }
    });

    nextServerProcess.on('error', (err) => {
      reject(err);
    });

    nextServerProcess.on('exit', (code) => {
      if (!isQuitting) {
        console.error(`Next.js server exited with code ${code}`);
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Next.js server failed to start within 30 seconds'));
    }, 30000);
  });
}

function createWindow(url: string) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(url);

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url: linkUrl }) => {
    shell.openExternal(linkUrl);
    return { action: 'deny' };
  });

  // Mac: hide window instead of closing
  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

// Mac menu
function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 Flomo-印象笔记' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { type: 'separator' },
        { role: 'front', label: '前置全部窗口' },
      ],
    },
  ];

  if (isDev) {
    template.push({
      label: '开发',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Cleanup: kill Next.js server on quit
function cleanup() {
  if (nextServerProcess && !nextServerProcess.killed) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
}

app.on('before-quit', () => {
  isQuitting = true;
  cleanup();
});

app.whenReady().then(async () => {
  createMenu();

  let url = DEV_URL;
  if (!isDev) {
    try {
      url = await startNextServer();
    } catch (err) {
      console.error('Failed to start Next.js server:', err);
      app.quit();
      return;
    }
  }

  createWindow(url);

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow(url);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
