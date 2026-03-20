const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 4000;

// Setup Folder
const dirs = ['uploads', 'uploads/icons', 'uploads/screenshots', 'uploads/metadata'];
dirs.forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

const settingsFile = path.join(__dirname, 'settings.json');
if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({
        adminWA: "628123456789",
        adminRek: "BCA 12345678 a/n Admin",
        users: [{ name: "Admin Utama", code: "DWD-2026" }]
    }, null, 2));
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'apkIcon') cb(null, 'uploads/icons');
        else if (file.fieldname === 'apkScreenshots') cb(null, 'uploads/screenshots');
        else cb(null, 'uploads');
    },
    filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static('public'));
app.use('/icons', express.static('uploads/icons'));
app.use('/screenshots', express.static('uploads/screenshots'));

// API Routes
app.get('/api/settings', (req, res) => res.json(JSON.parse(fs.readFileSync(settingsFile))));
app.post('/api/settings/update', (req, res) => {
    fs.writeFileSync(settingsFile, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});

// UPGRADED: Menampilkan SEMUA file metadata tanpa filter filteran
app.get('/api/files', (req, res) => {
    const metaDir = 'uploads/metadata';
    if (!fs.existsSync(metaDir)) return res.json([]);

    const files = fs.readdirSync(metaDir)
        .filter(f => f.endsWith('.json'))
        .map(m => {
            try {
                const metaPath = path.join(metaDir, m);
                const meta = JSON.parse(fs.readFileSync(metaPath));
                const apkName = m.replace('.json', '');
                const apkPath = path.join('uploads', apkName);

                // Pastikan file APK fisiknya ada agar tidak zonk di beranda
                if (fs.existsSync(apkPath)) {
                    const stat = fs.statSync(apkPath);
                    return { 
                        name: apkName, 
                        ...meta, 
                        size: (stat.size / 1024 / 1024).toFixed(2) + ' MB', 
                        date: stat.mtime 
                    };
                }
                return null;
            } catch (e) { return null; }
        })
        .filter(x => x !== null);
    
    // Sortir berdasarkan tanggal terbaru
    res.json(files.sort((a, b) => b.date - a.date));
});

app.post('/admin/upload', upload.fields([
    { name: 'apkFile', maxCount: 1 }, 
    { name: 'apkIcon', maxCount: 1 }, 
    { name: 'apkScreenshots', maxCount: 10 }
]), (req, res) => {
    try {
        const { accessCode, displayAppName, apkCategory, apkDescription } = req.body;
        const settings = JSON.parse(fs.readFileSync(settingsFile));
        const user = settings.users.find(u => u.code === accessCode);
        
        if (!user) return res.status(403).json({ success: false, message: "KODE AKSES TIDAK TERDAFTAR" });
        if (!req.files['apkFile']) return res.status(400).json({ success: false, message: "FILE APK KOSONG" });

        const apk = req.files['apkFile'][0];
        const meta = {
            displayName: displayAppName || apk.originalname,
            category: apkCategory || "Umum",
            description: apkDescription || "",
            owner: user.name,
            icon: req.files['apkIcon'] ? req.files['apkIcon'][0].filename : null,
            screenshots: req.files['apkScreenshots'] ? req.files['apkScreenshots'].map(f => f.filename) : []
        };
        
        fs.writeFileSync(path.join('uploads/metadata', apk.filename + '.json'), JSON.stringify(meta));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send("File APK sudah tidak ada di server");
    }
});

app.delete('/api/delete-file/:filename', (req, res) => {
    const fn = req.params.filename;
    const mp = path.join('uploads/metadata', fn + '.json');
    
    if (fs.existsSync(mp)) {
        const meta = JSON.parse(fs.readFileSync(mp));
        if (meta.icon) {
            const iconPath = path.join('uploads/icons', meta.icon);
            if (fs.existsSync(iconPath)) fs.unlinkSync(iconPath);
        }
        if (meta.screenshots) {
            meta.screenshots.forEach(s => {
                const ssPath = path.join('uploads/screenshots', s);
                if (fs.existsSync(ssPath)) fs.unlinkSync(ssPath);
            });
        }
        fs.unlinkSync(mp);
    }
    
    const apkFile = path.join('uploads', fn);
    if (fs.existsSync(apkFile)) fs.unlinkSync(apkFile);
    
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => console.log(`KEDAI APK DWD AKTIF DI PORT ${PORT}`));
