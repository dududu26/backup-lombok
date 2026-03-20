/**
 * LiveStream & Lombok Social Server v3.3
 * Port: 8226 | JSON Database + Ads Support + Live Link Support + Admin Delete + Co-host + Grid + Effects
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});

const DB_FILE = './posts.json';

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
    console.log('✅ File posts.json berhasil dibuat otomatis');
}

function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) { return []; }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'intro.html')); });

const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// --- API ENDPOINTS (SOCIAL FEED & ADS & LIVE LINKS) ---

app.get('/api/posts', (req, res) => {
  const posts = readDB();
  res.json(posts.slice().reverse());
});

app.post('/api/posts', upload.single('mediaFile'), (req, res) => {
  const { status, username, linkUrl, isAds, isLive } = req.body;
  const posts = readDB();
  
  const newPost = {
    id: uuidv4(),
    username: username || 'Warga Lombok',
    status: status || '',
    createdAt: new Date(),
    mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
    mediaType: req.file ? req.file.mimetype.split('/')[0] : null,
    linkUrl: linkUrl || null,
    isAds: (isAds === 'true' || isAds === true),
    isLive: (isLive === 'true' || isLive === true), // Field Baru untuk Link Streaming
    likesCount: 0,
    reactions: {},
    comments: []
  };

  posts.push(newPost);
  writeDB(posts);
  
  io.emit('post:new', newPost);
  res.status(201).json(newPost);
});

app.post('/api/posts/:id/react', (req, res) => {
  const { id } = req.params;
  const { emoji } = req.body;
  let posts = readDB();
  const index = posts.findIndex(p => p.id === id);
  
  if (index !== -1) {
    if (!emoji) posts[index].likesCount++;
    else posts[index].reactions[emoji] = (posts[index].reactions[emoji] || 0) + 1;
    
    writeDB(posts);
    io.emit('post:updated', posts[index]);
    res.json(posts[index]);
  } else res.status(404).send();
});

app.post('/api/posts/:id/comment', (req, res) => {
  const { id } = req.params;
  const { username, text } = req.body;
  let posts = readDB();
  const index = posts.findIndex(p => p.id === id);
  
  if (index !== -1) {
    posts[index].comments.push({ username, text, createdAt: new Date() });
    writeDB(posts);
    io.emit('post:updated', posts[index]);
    res.json(posts[index]);
  } else res.status(404).send();
});

app.delete('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  let posts = readDB();
  const filteredPosts = posts.filter(p => p.id !== id);
  
  if (posts.length !== filteredPosts.length) {
    writeDB(filteredPosts);
    io.emit('post:deleted', id);
    res.json({ success: true });
  } else {
    res.status(404).json({ message: "Post tidak ditemukan" });
  }
});

// --- LOGIKA LIVE STREAMING RTC (100% UTUH) ---
const activeStreams = new Map();
function getStreamList() {
  const list = [];
  activeStreams.forEach((info, streamId) => {
    list.push({
      streamId, title: info.title, hostName: info.hostName,
      startedAt: info.startedAt, viewerCount: info.viewers.size, cohostCount: info.cohosts.size
    });
  });
  return list;
}
function broadcastStreamList() { io.emit('streams:list', getStreamList()); }
function relay(targetId, event, data) { io.to(targetId).emit(event, data); }

io.on('connection', (socket) => {
  socket.on('host:register', ({ title, hostName }) => {
    const streamId = uuidv4().slice(0, 8).toUpperCase();
    activeStreams.set(streamId, {
      socketId: socket.id, title: title || 'Live Stream', hostName: hostName || 'Host',
      startedAt: Date.now(), viewers: new Set(), cohosts: new Set(), currentEffect: 'none'
    });
    socket.join(`stream:${streamId}`);
    socket.data = { role: 'host', streamId };
    socket.emit('host:registered', { streamId });
    broadcastStreamList();
  });

  socket.on('viewer:join', ({ streamId, viewerName }) => {
    const stream = activeStreams.get(streamId);
    if (!stream) return;
    socket.join(`stream:${streamId}`);
    socket.data = { role: 'viewer', streamId, displayName: viewerName };
    stream.viewers.add(socket.id);
    relay(stream.socketId, 'viewer:joined', { viewerId: socket.id, viewerName });
    io.to(`stream:${streamId}`).emit('viewer:count', { count: stream.viewers.size });
    socket.emit('effect:change', { effect: stream.currentEffect });
    broadcastStreamList();
  });

  socket.on('effect:change', ({ effect }) => {
    const { streamId, role } = socket.data;
    if (role === 'host' && activeStreams.has(streamId)) {
      activeStreams.get(streamId).currentEffect = effect;
      socket.to(`stream:${streamId}`).emit('effect:change', { effect });
    }
  });

  socket.on('cohost:request', ({ streamId }) => {
    const stream = activeStreams.get(streamId);
    if (stream) relay(stream.socketId, 'cohost:request', { viewerId: socket.id, viewerName: socket.data.displayName });
  });

  socket.on('cohost:accept', ({ viewerId }) => {
    const stream = activeStreams.get(socket.data.streamId);
    if (stream) {
      stream.cohosts.add(viewerId);
      relay(viewerId, 'cohost:accepted', { hostId: socket.id });
      relay(socket.id, 'cohost:initiate', { viewerId });
    }
  });

  socket.on('rtc:offer',  (d) => relay(d.targetId, 'rtc:offer',  { from: socket.id, offer: d.offer, label: d.label }));
  socket.on('rtc:answer', (d) => relay(d.targetId, 'rtc:answer', { from: socket.id, answer: d.answer, label: d.label }));
  socket.on('rtc:ice',    (d) => relay(d.targetId, 'rtc:ice',    { from: socket.id, candidate: d.candidate, label: d.label }));

  socket.on('chat:send', (data) => {
    io.to(`stream:${data.streamId}`).emit('chat:message', { id: uuidv4(), ...data, ts: Date.now() });
  });

  socket.on('disconnect', () => {
    const { role, streamId } = socket.data || {};
    if (role === 'host') {
      io.to(`stream:${streamId}`).emit('stream:ended');
      activeStreams.delete(streamId);
    } else if (streamId) {
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.viewers.delete(socket.id);
        stream.cohosts.delete(socket.id);
        io.to(`stream:${streamId}`).emit('viewer:count', { count: stream.viewers.size });
      }
    }
    broadcastStreamList();
  });
});

server.listen(8226, '0.0.0.0', () => console.log('🚀 Server V3.3 Aktif (Ads & Live Link Integration)'));
