const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const ADMIN_USERNAME = "dyby00";
const ADMIN_PASSWORD = "admin123";
const UPLOAD_DIR = './uploads';

// --- MIDDLEWARES ---
app.use(cors());
// On augmente la limite de taille pour le JSON (utile pour certaines requêtes, pas l'upload fichier)
app.use(express.json({ limit: '50gb' })); 
app.use(express.urlencoded({ limit: '50gb', extended: true }));

app.use(express.static('public'));
app.use('/uploads', express.static(UPLOAD_DIR));

// --- INITIALISATION ---
if (!fs.existsSync(UPLOAD_DIR)){
    fs.mkdirSync(UPLOAD_DIR);
}

// --- CONFIGURATION UPLOAD ILLIMITÉ ---
const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    // ⚠️ On a supprimé la section "limits" ici. 
    // Par défaut, Multer n'a plus de limite de taille.
});

// ================= ROUTES =================

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "Aucun fichier." });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    console.log(`[Gros Fichier] Uploadé : ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    res.json({
        success: true,
        url: fullUrl,
        type: req.file.mimetype,
        message: "Upload réussi !"
    });
});

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Identifiants incorrects" });
    }
});

app.get('/api/files', (req, res) => {
    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (err) return res.status(500).json({ error: "Erreur lecture dossier." });

        const fileList = files
            .filter(file => !['.gitkeep', '.gitignore', '.htaccess'].includes(file))
            .map(file => {
                const filePath = path.join(UPLOAD_DIR, file);
                try {
                    const stats = fs.statSync(filePath);
                    const ext = path.extname(file).toLowerCase();
                    let type = 'other';
                    if(['.jpg','.jpeg','.png','.gif','.webp', '.svg'].includes(ext)) type = 'image';
                    else if(['.mp4','.webm','.mov', '.avi', '.mkv'].includes(ext)) type = 'video';
                    else if(['.mp3','.wav','.ogg'].includes(ext)) type = 'audio';

                    return {
                        name: file,
                        url: `/uploads/${file}`,
                        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                        date: stats.mtime,
                        type: type
                    };
                } catch (e) { return null; }
            })
            .filter(f => f !== null)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(fileList);
    });
});

app.delete('/api/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, path.basename(filename));

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "Introuvable" });
    }
});

// --- DÉMARRAGE AVEC TIMEOUT INFINI ---
const server = app.listen(PORT, () => {
    console.log(`🚀 Serveur ILLIMITÉ lancé sur http://localhost:${PORT}`);
});

// IMPORTANT : Empêche le serveur de couper la connexion si l'upload est long
server.timeout = 0;      // 0 = Infini (pas de timeout)
server.keepAliveTimeout = 0;
