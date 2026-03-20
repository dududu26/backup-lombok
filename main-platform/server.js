const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const initDB = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const db = initDB();

// Memastikan folder upload ada
const uploadDir = './public/uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi Penyimpanan Media
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => { 
        cb(null, 'media-' + Date.now() + path.extname(file.originalname)); 
    }
});
const upload = multer({ storage: storage });

// Middleware & Statis
app.use(session({ 
    secret: 'lombok-pro-2026', 
    resave: false, 
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true 
    } 
}));

// Tambahan: Header anti-cache agar info login tidak nyangkut di device lain
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'auth.html')); });
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'auth.html')); });

// Proteksi Rute
const isAuth = (req, res, next) => { 
    if (req.session.user) next(); 
    else res.redirect('/auth'); 
};

// --- ROUTES UTAMA ---
app.get('/', isAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('/user/:id', isAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'user-view.html')));

// --- API AUTH ---

app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    db.users.findOne({ username }, (err, exists) => {
        if (exists) return res.status(400).json({ error: 'Username sudah digunakan' });
        
        db.users.insert({ 
            username, 
            password, 
            fullName: '', 
            profilePic: '/uploads/default.png', 
            bio: '',
            isNew: true,
            createdAt: new Date(),
            followers: [] 
        }, (err, doc) => {
            res.json({ redirect: '/auth', message: 'Daftar berhasil, silakan login' });
        });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.users.findOne({ username, password }, (err, user) => {
        if (user) { 
            req.session.user = { _id: user._id, username: user.username, fullName: user.fullName, profilePic: user.profilePic }; 
            const target = (user.isNew || !user.fullName) ? '/#profile' : '/';
            res.json({ redirect: target }); 
        }
        else res.status(401).json({ error: 'Login Gagal. Cek username/password.' });
    });
});

app.get('/logout', (req, res) => { 
    req.session.destroy(); 
    res.redirect('/auth'); 
});

// --- API PROFIL ---

app.get('/api/my-data', isAuth, (req, res) => {
    // UPGRADE: Mengambil data user terbaru + data profil followers secara otomatis
    db.users.findOne({ _id: req.session.user._id }, (err, user) => {
        if (!user) return res.status(404).json({ error: "User not found" });
        
        // Mengambil detail profil (nama/foto) untuk setiap ID di array followers
        db.users.find({ _id: { $in: user.followers || [] } }, (err, followersData) => {
            const enrichedUser = {
                ...user,
                followersData: followersData || []
            };
            res.json(enrichedUser);
        });
    });
});

app.get('/api/user-profile/:id', isAuth, (req, res) => {
    db.users.findOne({ _id: req.params.id }, (err, user) => {
        if (user) {
            const { password, ...safeUser } = user; 
            res.json(safeUser);
        } else res.status(404).json({ error: 'User tidak ditemukan' });
    });
});

app.post('/api/update-profile', isAuth, upload.single('photo'), (req, res) => {
    const updateData = { 
        fullName: req.body.fullName, 
        bio: req.body.bio,
        gender: req.body.gender,
        isNew: false 
    };
    if (req.file) updateData.profilePic = '/uploads/' + req.file.filename;

    db.users.update({ _id: req.session.user._id }, { $set: updateData }, {}, () => {
        db.users.findOne({ _id: req.session.user._id }, (err, updated) => {
            req.session.user = updated;
            res.redirect('/#profile');
        });
    });
});

// --- API KONTEN ---

app.get('/api/posts', isAuth, (req, res) => {
    db.posts.find({}).sort({ createdAt: -1 }).exec((err, docs) => res.json(docs || []));
});

app.post('/api/post', isAuth, upload.single('media'), (req, res) => {
    const isReel = req.body.isReel === 'true';
    
    // UPGRADE: Ambil data user dari DB sebelum posting agar Nama & Foto Profil selalu yang paling baru
    db.users.findOne({ _id: req.session.user._id }, (err, user) => {
        const newPost = {
            userId: user._id,
            fullName: user.fullName || user.username,
            profilePic: user.profilePic || '/uploads/default.png',
            content: req.body.content || '',
            bgColor: req.body.bgColor || 'transparent', 
            media: req.file ? '/uploads/' + req.file.filename : null,
            mediaType: req.file ? (req.file.mimetype.includes('video') ? 'video' : 'image') : null,
            isReel: isReel,
            likes: [],
            comments: [],
            createdAt: new Date()
        };
        db.posts.insert(newPost, (err, doc) => {
            io.emit('update-post'); 
            res.redirect(isReel ? '/#reels' : '/');
        });
    });
});

// --- API SOSIAL & NOTIFIKASI ---

app.get('/api/notifications', isAuth, (req, res) => {
    db.notifications.find({ to: req.session.user._id }).sort({ date: -1 }).exec((err, docs) => res.json(docs || []));
});

app.post('/api/follow/:id', isAuth, (req, res) => {
    const targetId = req.params.id;
    const myId = req.session.user._id;

    if (targetId === myId) return res.status(400).json({ error: "Self-follow forbidden" });

    db.users.findOne({ _id: targetId }, (err, targetUser) => {
        if (!targetUser) return res.status(404).json({ error: "User not found" });

        let followers = targetUser.followers || [];
        const index = followers.indexOf(myId);
        let action = "";

        if (index > -1) {
            followers.splice(index, 1);
            action = "unfollowed";
        } else {
            followers.push(myId);
            action = "followed";

            const notif = {
                to: targetId,
                from: req.session.user.fullName || req.session.user.username,
                fromId: myId,
                type: 'follow',
                date: new Date(),
                isRead: false
            };
            db.notifications.insert(notif, (err, doc) => {
                io.to(targetId).emit('notification-received', doc);
            });
        }

        db.users.update({ _id: targetId }, { $set: { followers: followers } }, {}, () => {
            res.json({ success: true, action, count: followers.length });
        });
    });
});

// --- SOCKET.IO REAL-TIME UPGRADED ---

io.on('connection', (socket) => {
    
    socket.on('join-room', (userId) => {
        // UPGRADE: Memastikan userId dikonversi ke string agar room stabil
        if(userId) socket.join(userId.toString());
    });

    socket.on('start-live-notification', (data) => {
        db.users.findOne({ _id: data.userId }, (err, user) => {
            if (user && user.followers && user.followers.length > 0) {
                user.followers.forEach(followerId => {
                    const liveNotif = {
                        to: followerId,
                        from: data.userName,
                        fromId: data.userId,
                        type: 'live',
                        date: new Date(),
                        isRead: false
                    };

                    db.notifications.insert(liveNotif, (err, doc) => {
                        io.to(followerId).emit('notification-received', doc);
                    });
                });
            }
        });
    });

    socket.on('like-post', (data) => {
        db.posts.findOne({ _id: data.postId }, (err, post) => {
            if (!post) return;
            let likes = post.likes || [];
            const index = likes.indexOf(data.userId);

            if (index > -1) {
                likes.splice(index, 1);
            } else {
                likes.push(data.userId);
                if (post.userId !== data.userId) {
                    const notif = { 
                        to: post.userId, 
                        from: data.fullName, 
                        fromId: data.userId,
                        postId: data.postId,
                        type: 'like', 
                        date: new Date(),
                        isRead: false
                    };
                    db.notifications.insert(notif, (err, doc) => {
                        io.to(post.userId).emit('notification-received', doc);
                    });
                }
            }
            db.posts.update({ _id: data.postId }, { $set: { likes } }, {}, () => {
                io.emit('update-post');
            });
        });
    });

    socket.on('new-comment', (data) => {
        db.posts.findOne({ _id: data.postId }, (err, post) => {
            if (!post) return;
            const newComment = { from: data.from, userId: data.userId, text: data.text, date: new Date() };
            const comments = post.comments || [];
            comments.push(newComment);

            db.posts.update({ _id: data.postId }, { $set: { comments } }, {}, () => {
                if (post.userId !== data.userId) {
                    const notif = {
                        to: post.userId,
                        from: data.from,
                        fromId: data.userId,
                        postId: data.postId,
                        type: 'comment',
                        date: new Date(),
                        isRead: false
                    };
                    db.notifications.insert(notif, (err, doc) => {
                        io.to(post.userId).emit('notification-received', doc);
                    });
                }
                io.emit('update-comments', { postId: data.postId, comments });
            });
        });
    });

    socket.on('delete-post', (data) => {
        db.posts.findOne({ _id: data.postId }, (err, post) => {
            if (post && post.userId === data.userId) {
                if (post.media) {
                    const filePath = path.join(__dirname, 'public', post.media);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
                
                db.posts.remove({ _id: data.postId }, {}, () => {
                    io.emit('update-post'); 
                });
            }
        });
    });

});

const PORT = 8223;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ===========================================
    LOMBOK STREAMING PRO AKTIF
    URL: http://localhost:${PORT}
    IP: 0.0.0.0 (Bisa diakses via Ngrok)
    ===========================================
    `);
});

