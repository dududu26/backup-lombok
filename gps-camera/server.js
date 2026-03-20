const express = require('express');
const path = require('path');
const app = express();
const PORT = 5000;

// Menangani data besar untuk upload
app.use(express.json({ limit: '50mb' }));

// PENTING: Mengarahkan server untuk membaca file di dalam folder 'public'
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'intro.html')); });

// Route utama
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'intro.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`GPS Server aktif di port ${PORT}`);
});
