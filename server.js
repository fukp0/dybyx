const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mega = require('megajs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION MEGA ---
// Récupérez ces infos depuis votre compte MEGA
const MEGA_EMAIL = process.env.MEGA_EMAIL || "tizergameht@gmail.com";
const MEGA_PASSWORD = process.env.MEGA_PASSWORD || "mike12&&";
const MEGA_FOLDER = process.env.MEGA_FOLDER || "CloudMedia"; // Nom du dossier dans MEGA

// --- CONFIGURATION ---
const ADMIN_PASSWORD = "mike12&&";
const TEMP_DIR = './temp_uploads'; // Dossier temporaire local

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- INITIALISATION ---
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// --- CONFIGURATION UPLOAD TEMPORAIRE ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, extension)
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 50);
        cb(null, baseName + '_' + uniqueSuffix + extension);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max pour MEGA free
    }
});

// ================= ROUTES MEGA =================

// Fonction pour se connecter à MEGA
async function connectToMega() {
    return new Promise((resolve, reject) => {
        const storage = new mega.Storage({
            email: MEGA_EMAIL,
            password: MEGA_PASSWORD
        }, (err) => {
            if (err) {
                console.error('❌ Erreur connexion MEGA:', err);
                reject(err);
            } else {
                console.log('✅ Connecté à MEGA');
                resolve(storage);
            }
        });
    });
}

// Route d'upload vers MEGA
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: "Aucun fichier sélectionné" 
            });
        }

        console.log(`📤 Upload vers MEGA: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

        // Se connecter à MEGA
        const storage = await connectToMega();
        
        // Trouver ou créer le dossier
        let folder = storage.root.children.find(child => 
            child.name === MEGA_FOLDER && child.directory
        );
        
        if (!folder) {
            folder = await storage.mkdir(MEGA_FOLDER);
            console.log(`📁 Dossier créé: ${MEGA_FOLDER}`);
        }

        // Lire le fichier temporaire
        const fileBuffer = fs.readFileSync(req.file.path);
        
        // Uploader vers MEGA
        const megaFile = await folder.upload(req.file.originalname, fileBuffer, {
            attributes: {
                originalName: req.file.originalname,
                size: req.file.size,
                uploadedAt: new Date().toISOString()
            }
        });

        // Générer le lien de téléchargement
        const link = await megaFile.link();
        
        // Supprimer le fichier temporaire
        fs.unlinkSync(req.file.path);

        console.log(`✅ Fichier uploadé sur MEGA: ${req.file.originalname}`);
        console.log(`🔗 Lien: ${link}`);

        res.json({
            success: true,
            url: link,
            type: req.file.mimetype,
            filename: req.file.originalname,
            size: req.file.size,
            sizeMB: (req.file.size / 1024 / 1024).toFixed(2),
            message: "✅ Upload réussi sur MEGA !"
        });

    } catch (error) {
        console.error('❌ Erreur MEGA:', error);
        
        // Nettoyer le fichier temporaire en cas d'erreur
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false, 
            message: `Erreur lors de l'upload MEGA: ${error.message}` 
        });
    }
});

// Route pour lister les fichiers MEGA
app.get('/api/files', async (req, res) => {
    try {
        const storage = await connectToMega();
        
        // Trouver le dossier
        let folder = storage.root.children.find(child => 
            child.name === MEGA_FOLDER && child.directory
        );

        if (!folder) {
            return res.json({
                success: true,
                files: [],
                message: "Aucun dossier trouvé"
            });
        }

        // Charger les fichiers du dossier
        await folder.loadChildren();
        
        const fileList = folder.children
            .filter(child => !child.directory) // Filtrer seulement les fichiers
            .map(file => {
                const extension = path.extname(file.name).toLowerCase();
                let type = 'other';
                
                if(['.jpg','.jpeg','.png','.gif','.webp'].includes(extension)) type = 'image';
                else if(['.mp4','.webm','.mov','.avi','.mkv'].includes(extension)) type = 'video';
                else if(['.mp3','.wav','.ogg'].includes(extension)) type = 'audio';
                else if(['.pdf','.doc','.docx','.txt'].includes(extension)) type = 'document';
                
                return {
                    name: file.name,
                    size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                    date: file.timestamp || new Date(),
                    type: type,
                    downloadKey: file.downloadId
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            files: fileList,
            total: fileList.length,
            folder: MEGA_FOLDER
        });

    } catch (error) {
        console.error('❌ Erreur liste fichiers MEGA:', error);
        res.status(500).json({ 
            success: false, 
            message: "Erreur lors de la récupération des fichiers" 
        });
    }
});

// Route pour supprimer un fichier MEGA
app.delete('/api/files/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const storage = await connectToMega();
        
        // Trouver le dossier
        let folder = storage.root.children.find(child => 
            child.name === MEGA_FOLDER && child.directory
        );

        if (!folder) {
            return res.status(404).json({ 
                success: false, 
                message: "Dossier non trouvé" 
            });
        }

        // Charger les fichiers
        await folder.loadChildren();
        
        // Trouver le fichier
        const fileToDelete = folder.children.find(child => 
            !child.directory && child.name === filename
        );

        if (!fileToDelete) {
            return res.status(404).json({ 
                success: false, 
                message: "Fichier non trouvé" 
            });
        }

        // Supprimer le fichier
        await fileToDelete.delete();
        
        console.log(`🗑️ Fichier supprimé de MEGA: ${filename}`);
        
        res.json({ 
            success: true, 
            message: "Fichier supprimé avec succès" 
        });

    } catch (error) {
        console.error('❌ Erreur suppression MEGA:', error);
        res.status(500).json({ 
            success: false, 
            message: `Erreur lors de la suppression: ${error.message}` 
        });
    }
});

// Route pour obtenir les statistiques MEGA
app.get('/api/stats', async (req, res) => {
    try {
        const storage = await connectToMega();
        
        // Note: L'API MEGA ne fournit pas directement les statistiques de stockage
        // Vous devrez peut-être utiliser une autre approche
        
        res.json({
            success: true,
            storage: "MEGA Cloud",
            account: MEGA_EMAIL,
            folder: MEGA_FOLDER,
            note: "Les statistiques détaillées ne sont pas disponibles via l'API publique"
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Erreur statistiques" 
        });
    }
});

// Login admin
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Mot de passe incorrect" });
    }
});

// Route de test
app.get('/api/test', (req, res) => {
    res.json({
        service: "Cloud Media MEGA",
        status: "running",
        storage: "MEGA.nz",
        maxFileSize: "100MB",
        endpoints: {
            upload: "POST /upload",
            listFiles: "GET /api/files",
            deleteFile: "DELETE /api/files/:filename",
            stats: "GET /api/stats",
            login: "POST /api/login"
        }
    });
});

// Nettoyage périodique des fichiers temporaires
setInterval(() => {
    if (fs.existsSync(TEMP_DIR)) {
        fs.readdir(TEMP_DIR, (err, files) => {
            if (err) return;
            
            const now = Date.now();
            files.forEach(file => {
                const filePath = path.join(TEMP_DIR, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    
                    // Supprimer les fichiers temporaires vieux de plus d'1 heure
                    if (now - stats.mtimeMs > 3600000) {
                        fs.unlink(filePath, () => {});
                    }
                });
            });
        });
    }
}, 3600000); // Toutes les heures

// --- DÉMARRAGE SERVEUR ---
app.listen(PORT, () => {
    console.log(`🚀 Serveur MEGA lancé sur http://localhost:${PORT}`);
    console.log(`☁️  Stockage: MEGA.nz`);
    console.log(`📧 Compte: ${MEGA_EMAIL}`);
    console.log(`📁 Dossier: ${MEGA_FOLDER}`);
    console.log(`📤 Upload max: 100MB (limite MEGA free)`);
    console.log(`\n⚠️  IMPORTANT: Configurez vos identifiants MEGA !`);
    console.log(`   MEGA_EMAIL=votre-email@exemple.com`);
    console.log(`   MEGA_PASSWORD=votre-mot-de-passe`);
    console.log(`   MEGA_FOLDER=CloudMedia`);
});
