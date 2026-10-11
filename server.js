const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getUploadDir() {
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'uploads');
    }
  } catch (e) {}
  
  const baseDir = process.env.APPDATA || os.tmpdir();
  return path.join(baseDir, 'quick-transfer', 'uploads');
}

const uploadDir = getUploadDir();

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniquePrefix}-${safeName}`);
  }
});

const upload = multer({ storage });

app.get('/device-info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  res.json({
    hostname: os.hostname(),
    ips: addresses,
    port: PORT
  });
});

app.post('/upload', upload.any(), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files received' });
  }
  const files = req.files.map(file => ({
    filename: file.filename,
    originalname: file.originalname,
    size: file.size,
    url: `/uploads/${encodeURIComponent(file.filename)}`
  }));
  res.json({ message: 'Files uploaded successfully', files });
});

app.get('/files', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Unable to scan directory' });
    
    const fileList = [];
    files.forEach(filename => {
      const filePath = path.join(uploadDir, filename);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          fileList.push({
            filename,
            originalname: filename.replace(/^\d+-\d+-/, ''),
            size: stats.size || 0,
            createdAt: stats.birthtime || stats.mtime || null,
            url: `/uploads/${encodeURIComponent(filename)}`
          });
        }
      } catch (e) {}
    });

    res.json(fileList);
  });
});

app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath, filename);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.delete('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, err => {
      if (err) return res.status(500).json({ error: 'Failed to delete' });
      res.json({ message: 'File deleted' });
    });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;