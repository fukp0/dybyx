const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const ADMIN_PASSWORD = "admin123"; // ⚠️ Change le mot de passe ici
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Sert le dossier 'public' (index.html)
app.use('/uploads', express.static('uploads')); // Rend les fichiers uploadés accessibles

// Configuration de stockage (Multer)
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
        // Nom unique : date + nombre aléatoire + extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // Limite 100MB
});

// --- ROUTES API ---

// 1. Route d'Upload (Remplace upload.php)
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "Aucun fichier envoyé" });
    }

    // Création du lien
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.json({
        success: true,
        url: fullUrl,
        type: req.file.mimetype,
        message: "Fichier uploadé avec succès !"
    });
});

// 2. Route Login Admin
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Mauvais mot de passe" });
    }
});

// 3. Route Liste des fichiers (Pour l'admin)
app.get('/api/files', (req, res) => {
    const uploadDir = './uploads';
    
    // Vérifier si dossier existe
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
    }

    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Erreur lecture dossier" });

        const fileList = files
            .filter(file => file !== '.gitkeep' && file !== '.gitignore') // Ignorer fichiers système
            .map(file => {
                const filePath = path.join(uploadDir, file);
                const stats = fs.statSync(filePath);
                const ext = path.extname(file).toLowerCase();
                
                let type = 'other';
                if(['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) type = 'image';
                else if(['.mp4','.webm','.mov'].includes(ext)) type = 'video';
                else if(['.mp3','.wav','.ogg'].includes(ext)) type = 'audio';

                return {
                    name: file,
                    url: `/uploads/${file}`, // Lien relatif
                    size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                    date: stats.mtime,
                    type: type
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Trier par date

        res.json(fileList);
    });
});

// 4. Route Suppression (Pour l'admin)
app.delete('/api/files/:filename', (req, res) => {
    // Note: Dans un vrai projet, ajoute une vérification de token/session ici
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "Fichier introuvable" });
    }
});

// Démarrage
app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
