const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mega = require('megajs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION MEGA ---
// RÉGLEZ CES VARIABLES AVANT DE DÉMARRER !
const MEGA_EMAIL = process.env.MEGA_EMAIL || "tizergameht@gmail.com";
const MEGA_PASSWORD = process.env.MEGA_PASSWORD || "mike12&&";
const MEGA_FOLDER = process.env.MEGA_FOLDER || "CloudMedia";

// --- CONFIGURATION ---
const ADMIN_PASSWORD = "mike12&&";
const TEMP_DIR = './temp_uploads';

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

// Fonction pour se connecter à MEGA avec gestion d'erreurs améliorée
async function connectToMega() {
    return new Promise((resolve, reject) => {
        console.log('🔐 Tentative de connexion à MEGA...');
        
        try {
            const storage = new mega.Storage({
                email: MEGA_EMAIL,
                password: MEGA_PASSWORD,
                autologin: false,
                autoload: false
            }, (err) => {
                if (err) {
                    console.error('❌ Erreur connexion MEGA:', err.message);
                    reject(new Error(`Erreur connexion MEGA: ${err.message}`));
                } else {
                    console.log('✅ Connecté à MEGA avec succès');
                    
                    // Charger les données du compte
                    storage.on('ready', () => {
                        console.log('📦 Stockage MEGA prêt');
                        resolve(storage);
                    });
                    
                    storage.on('error', (err) => {
                        console.error('❌ Erreur stockage MEGA:', err.message);
                        reject(err);
                    });
                    
                    // Forcer le chargement
                    storage.load((loadErr) => {
                        if (loadErr) {
                            console.error('❌ Erreur chargement MEGA:', loadErr.message);
                            reject(loadErr);
                        }
                    });
                }
            });
        } catch (error) {
            console.error('❌ Exception connexion MEGA:', error.message);
            reject(error);
        }
    });
}

// Route d'upload vers MEGA avec plus de logs
app.post('/upload', upload.single('file'), async (req, res) => {
    console.log('📤 Début upload route');
    
    try {
        if (!req.file) {
            console.log('❌ Aucun fichier reçu');
            return res.status(400).json({ 
                success: false, 
                message: "Aucun fichier sélectionné" 
            });
        }

        console.log(`📤 Fichier reçu: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`📁 Chemin temporaire: ${req.file.path}`);

        // Vérifier si le fichier temporaire existe
        if (!fs.existsSync(req.file.path)) {
            console.log('❌ Fichier temporaire introuvable');
            return res.status(500).json({ 
                success: false, 
                message: "Erreur interne: fichier temporaire perdu" 
            });
        }

        // Se connecter à MEGA
        console.log('🔗 Connexion à MEGA...');
        let storage;
        try {
            storage = await connectToMega();
        } catch (error) {
            console.error('❌ Échec connexion MEGA:', error.message);
            
            // Nettoyer le fichier temporaire
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            return res.status(500).json({ 
                success: false, 
                message: `Erreur connexion MEGA: ${error.message}. Vérifiez vos identifiants.` 
            });
        }

        // Trouver ou créer le dossier
        console.log(`📂 Recherche du dossier: ${MEGA_FOLDER}`);
        let folder;
        
        try {
            // Chercher le dossier existant
            folder = storage.root.children.find(child => 
                child && child.name === MEGA_FOLDER && child.directory
            );
            
            if (!folder) {
                console.log(`📂 Création du dossier: ${MEGA_FOLDER}`);
                folder = await storage.mkdir(MEGA_FOLDER);
                console.log(`✅ Dossier créé: ${MEGA_FOLDER}`);
            } else {
                console.log(`✅ Dossier trouvé: ${MEGA_FOLDER}`);
            }
        } catch (error) {
            console.error('❌ Erreur dossier MEGA:', error.message);
            
            // Nettoyer
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            return res.status(500).json({ 
                success: false, 
                message: `Erreur gestion dossier MEGA: ${error.message}` 
            });
        }

        // Lire le fichier temporaire
        console.log('📖 Lecture du fichier temporaire...');
        let fileBuffer;
        try {
            fileBuffer = fs.readFileSync(req.file.path);
            console.log(`✅ Fichier lu: ${fileBuffer.length} bytes`);
        } catch (error) {
            console.error('❌ Erreur lecture fichier:', error.message);
            return res.status(500).json({ 
                success: false, 
                message: `Erreur lecture fichier: ${error.message}` 
            });
        }

        // Uploader vers MEGA
        console.log('⬆️ Upload vers MEGA...');
        let megaFile;
        try {
            megaFile = await folder.upload(req.file.originalname, fileBuffer, {
                attributes: {
                    originalName: req.file.originalname,
                    size: req.file.size.toString(),
                    uploadedAt: new Date().toISOString(),
                    mimetype: req.file.mimetype
                }
            });
            console.log(`✅ Fichier uploadé sur MEGA: ${megaFile.name}`);
        } catch (error) {
            console.error('❌ Erreur upload MEGA:', error.message);
            
            // Nettoyer
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            return res.status(500).json({ 
                success: false, 
                message: `Erreur upload MEGA: ${error.message}` 
            });
        }

        // Générer le lien de téléchargement
        console.log('🔗 Génération du lien...');
        let link;
        try {
            link = await megaFile.link();
            console.log(`✅ Lien généré: ${link}`);
        } catch (error) {
            console.error('❌ Erreur génération lien:', error.message);
            
            // On a quand même le fichier, on peut retourner un succès partiel
            link = `Fichier uploadé mais erreur lien: ${error.message}`;
        }

        // Supprimer le fichier temporaire
        try {
            fs.unlinkSync(req.file.path);
            console.log('🗑️ Fichier temporaire supprimé');
        } catch (error) {
            console.warn('⚠️ Impossible de supprimer le fichier temporaire:', error.message);
        }

        console.log('✅ Upload terminé avec succès!');

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
        console.error('💥 ERREUR GÉNÉRALE:', error);
        console.error('Stack trace:', error.stack);
        
        // Nettoyer le fichier temporaire en cas d'erreur
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error('Erreur nettoyage:', unlinkError.message);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            message: `Erreur serveur: ${error.message}`,
            errorDetails: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Route pour lister les fichiers MEGA (simplifiée)
app.get('/api/files', async (req, res) => {
    console.log('📁 Liste fichiers demandée');
    
    try {
        const storage = await connectToMega();
        
        // Trouver le dossier
        let folder = storage.root.children.find(child => 
            child && child.name === MEGA_FOLDER && child.directory
        );

        if (!folder) {
            console.log('📁 Dossier non trouvé, retour liste vide');
            return res.json({
                success: true,
                files: [],
                message: "Aucun dossier trouvé, premier upload créera le dossier"
            });
        }

        // Charger les fichiers du dossier
        console.log('🔄 Chargement des fichiers...');
        await folder.loadChildren();
        
        console.log(`📊 ${folder.children.length} éléments trouvés`);
        
        const fileList = folder.children
            .filter(child => child && !child.directory) // Filtrer seulement les fichiers
            .map(file => {
                const extension = path.extname(file.name).toLowerCase();
                let type = 'other';
                
                if(['.jpg','.jpeg','.png','.gif','.webp'].includes(extension)) type = 'image';
                else if(['.mp4','.webm','.mov','.avi','.mkv'].includes(extension)) type = 'video';
                else if(['.mp3','.wav','.ogg'].includes(extension)) type = 'audio';
                else if(['.pdf','.doc','.docx','.txt','.zip'].includes(extension)) type = 'document';
                
                return {
                    name: file.name,
                    size: file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : '0 MB',
                    date: file.timestamp || new Date(),
                    type: type
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        console.log(`✅ ${fileList.length} fichiers retournés`);

        res.json({
            success: true,
            files: fileList,
            total: fileList.length,
            folder: MEGA_FOLDER
        });

    } catch (error) {
        console.error('❌ Erreur liste fichiers MEGA:', error.message);
        res.status(500).json({ 
            success: false, 
            message: "Erreur lors de la récupération des fichiers",
            error: error.message
        });
    }
});

// Route pour supprimer un fichier MEGA (simplifiée)
app.delete('/api/files/:filename', async (req, res) => {
    const filename = req.params.filename;
    console.log(`🗑️ Demande suppression: ${filename}`);
    
    try {
        const storage = await connectToMega();
        
        // Trouver le dossier
        let folder = storage.root.children.find(child => 
            child && child.name === MEGA_FOLDER && child.directory
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
            child && !child.directory && child.name === filename
        );

        if (!fileToDelete) {
            return res.status(404).json({ 
                success: false, 
                message: "Fichier non trouvé" 
            });
        }

        // Supprimer le fichier
        await fileToDelete.delete();
        
        console.log(`✅ Fichier supprimé de MEGA: ${filename}`);
        
        res.json({ 
            success: true, 
            message: "Fichier supprimé avec succès" 
        });

    } catch (error) {
        console.error('❌ Erreur suppression MEGA:', error.message);
        res.status(500).json({ 
            success: false, 
            message: `Erreur lors de la suppression: ${error.message}` 
        });
    }
});

// Route pour obtenir les statistiques MEGA (simplifiée)
app.get('/api/stats', async (req, res) => {
    console.log('📊 Statistiques demandées');
    
    try {
        const storage = await connectToMega();
        
        res.json({
            success: true,
            storage: "MEGA Cloud",
            account: MEGA_EMAIL.substring(0, 3) + '***' + MEGA_EMAIL.substring(MEGA_EMAIL.indexOf('@')),
            folder: MEGA_FOLDER,
            note: "Les statistiques détaillées ne sont pas disponibles via l'API publique MEGA"
        });
        
    } catch (error) {
        console.error('❌ Erreur statistiques:', error.message);
        res.status(500).json({ 
            success: false, 
            message: "Erreur statistiques" 
        });
    }
});

// Login admin
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    console.log('🔐 Tentative login admin');
    
    if (password === ADMIN_PASSWORD) {
        console.log('✅ Login admin réussi');
        res.json({ 
            success: true,
            message: "Authentification réussie"
        });
    } else {
        console.log('❌ Login admin échoué');
        res.json({ 
            success: false, 
            message: "Mot de passe incorrect" 
        });
    }
});

// Route de test améliorée
app.get('/api/test', async (req, res) => {
    console.log('🧪 Test serveur demandé');
    
    try {
        // Tester la connexion MEGA
        const storage = await connectToMega();
        
        res.json({
            service: "Cloud Media MEGA",
            status: "running",
            storage: "MEGA.nz",
            maxFileSize: "100MB",
            mega: {
                connected: true,
                account: MEGA_EMAIL.substring(0, 3) + '***',
                folder: MEGA_FOLDER
            },
            server: {
                port: PORT,
                tempDir: TEMP_DIR,
                uptime: process.uptime()
            },
            endpoints: {
                upload: "POST /upload",
                listFiles: "GET /api/files",
                deleteFile: "DELETE /api/files/:filename",
                stats: "GET /api/stats",
                login: "POST /api/login",
                test: "GET /api/test"
            }
        });
        
    } catch (error) {
        console.error('❌ Test échoué:', error.message);
        res.status(500).json({
            service: "Cloud Media MEGA",
            status: "error",
            error: error.message,
            mega: {
                connected: false,
                error: "Connexion MEGA échouée"
            },
            note: "Vérifiez vos identifiants MEGA dans le fichier .env"
        });
    }
});

// Nettoyage périodique des fichiers temporaires
setInterval(() => {
    if (fs.existsSync(TEMP_DIR)) {
        fs.readdir(TEMP_DIR, (err, files) => {
            if (err) {
                console.error('❌ Erreur nettoyage temp:', err.message);
                return;
            }
            
            const now = Date.now();
            files.forEach(file => {
                const filePath = path.join(TEMP_DIR, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    
                    // Supprimer les fichiers temporaires vieux de plus d'1 heure
                    if (now - stats.mtimeMs > 3600000) {
                        fs.unlink(filePath, (err) => {
                            if (!err) {
                                console.log(`🧹 Fichier temporaire nettoyé: ${file}`);
                            }
                        });
                    }
                });
            });
        });
    }
}, 3600000); // Toutes les heures

// Middleware pour gérer les erreurs 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route non trouvée",
        availableRoutes: [
            "GET /",
            "POST /upload",
            "GET /api/files",
            "DELETE /api/files/:filename",
            "GET /api/stats",
            "POST /api/login",
            "GET /api/test"
        ]
    });
});

// Middleware global de gestion d'erreurs
app.use((err, req, res, next) => {
    console.error('💥 ERREUR NON GÉRÉE:', err);
    res.status(500).json({
        success: false,
        message: "Erreur serveur interne",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// --- DÉMARRAGE SERVEUR ---
app.listen(PORT, () => {
    console.log(`\n🚀 ===========================================`);
    console.log(`🚀 Serveur MEGA lancé sur http://localhost:${PORT}`);
    console.log(`🚀 ===========================================\n`);
    console.log(`📋 CONFIGURATION:`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Email MEGA: ${MEGA_EMAIL}`);
    console.log(`   Dossier MEGA: ${MEGA_FOLDER}`);
    console.log(`   Dossier temp: ${TEMP_DIR}\n`);
    
    console.log(`🔍 DIAGNOSTIC:`);
    
    // Vérifier le dossier temp
    if (fs.existsSync(TEMP_DIR)) {
        console.log(`   ✅ Dossier temp existe: ${TEMP_DIR}`);
    } else {
        console.log(`   ❌ Dossier temp manquant: ${TEMP_DIR}`);
    }
    
    // Vérifier les identifiants MEGA
    if (MEGA_EMAIL === "tizergameht@gmail.com") {
        console.log(`   ⚠️  ATTENTION: Email MEGA non configuré!`);
        console.log(`   👉 Configurez MEGA_EMAIL dans .env ou modifiez server.js`);
    }
    
    if (MEGA_PASSWORD === "votre-mot-de-passe") {
        console.log(`   ⚠️  ATTENTION: Mot de passe MEGA non configuré!`);
        console.log(`   👉 Configurez MEGA_PASSWORD dans .env ou modifiez server.js`);
    }
    
    console.log(`\n🌐 ENDPOINTS:`);
    console.log(`   POST /upload          - Uploader un fichier`);
    console.log(`   GET  /api/files       - Lister les fichiers`);
    console.log(`   DELETE /api/files/*   - Supprimer un fichier`);
    console.log(`   GET  /api/stats       - Statistiques`);
    console.log(`   POST /api/login       - Login admin`);
    console.log(`   GET  /api/test        - Tester la connexion\n`);
    
    console.log(`💡 CONSEIL:`);
    console.log(`   1. Créez un fichier .env avec vos identifiants MEGA`);
    console.log(`   2. Testez avec: curl http://localhost:${PORT}/api/test`);
    console.log(`   3. Vérifiez les logs pour les erreurs détaillées\n`);
});
