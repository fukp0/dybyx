const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const ADMIN_PASSWORD = "admin123";
const UPLOAD_DIR = './uploads';

// --- MIDDLEWARES ---
app. use(cors({
    origin: '*', // Permet tous les domaines
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false
}));

// Headers pour compatibilité maximale
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    res. header('Cross-Origin-Resource-Policy', 'cross-origin');
    res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
    
    // Pour les images dans <img>, <video>, etc.
    if (req.path.startsWith('/uploads/')) {
        res.header('Cache-Control', 'public, max-age=31536000'); // Cache 1 an
        res.header('Content-Disposition', 'inline'); // Affichage direct
    }
    
    next();
});

app.use(express. json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers uploadés avec headers optimisés
app.use('/uploads', (req, res, next) => {
    // Headers pour compatibilité maximale
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    res.header('Content-Type', 'application/octet-stream');
    
    // Détecter le type de fichier
    const ext = path.extname(req.path).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '. gif', '.webp', '.bmp'].includes(ext)) {
        res.header('Content-Type', `image/${ext. slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`);
    } else if (['.mp4', '.webm', '.mov', '.avi']. includes(ext)) {
        res.header('Content-Type', `video/${ext.slice(1)}`);
    } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
        res.header('Content-Type', `audio/${ext.slice(1)}`);
    } else if (ext === '.svg') {
        res.header('Content-Type', 'image/svg+xml');
    }
    
    next();
}, express.static(UPLOAD_DIR));

app.use(express.static('public')); // Servir le frontend

// --- INITIALISATION ---
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log(`📁 Dossier upload créé: ${UPLOAD_DIR}`);
}

// --- CONFIGURATION UPLOAD LOCAL ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Nom de fichier unique
        const timestamp = Date.now();
        const randomString = Math.random(). toString(36).substring(2, 15);
        const originalName = path.parse(file.originalname).name;
        const extension = path. extname(file.originalname) || '.bin';
        
        // Nettoyer le nom
        const safeName = originalName
            .replace(/[^a-zA-Z0-9-_]/g, '_')
            .substring(0, 100);
        
        const uniqueFilename = `${safeName}_${timestamp}_${randomString}${extension}`;
        cb(null, uniqueFilename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB max
        fieldSize: 10 * 1024 * 1024 // 10MB pour les champs
    },
    fileFilter: (req, file, cb) => {
        // Accepter tous les fichiers
        cb(null, true);
    }
});

// ================= ROUTES SIMPLES =================

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'running',
        storage: 'local',
        uploadDir: UPLOAD_DIR,
        maxFileSize: '2GB',
        cors: 'enabled',
        crossOrigin: 'compatible'
    });
});

// Route UPLOAD (LOCAL) - Compatible tous navigateurs/projets
app.post('/upload', upload.single('file'), (req, res) => {
    try {
        console.log('📤 Upload demandé.. .');
        
        if (!req.file) {
            console.log('❌ Aucun fichier reçu');
            return res.status(400).json({ 
                success: false, 
                message: "Aucun fichier sélectionné" 
            });
        }

        console.log(`✅ Fichier reçu: ${req.file. originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`📁 Sauvegardé comme: ${req.file.filename}`);

        // Construire l'URL complète compatible
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.get('host');
        const url = `${protocol}://${host}/uploads/${req.file.filename}`;

        console.log(`🔗 URL générée: ${url}`);

        // Réponse avec toutes les infos nécessaires
        res.json({
            success: true,
            url: url,
            directUrl: url, // Même URL pour compatibilité
            publicUrl: url, // URL publique
            cdnUrl: url,    // Compatible CDN
            embedUrl: url,  // Pour embed
            type: req.file. mimetype || 'application/octet-stream',
            filename: req.file.originalname,
            savedAs: req.file. filename,
            size: req.file.size,
            sizeMB: (req.file.size / 1024 / 1024).toFixed(2),
            message: "✅ Upload réussi !",
            timestamp: new Date().toISOString(),
            // Infos pour développeurs
            usage: {
                html: `<img src="${url}" alt="${req.file.originalname}">`,
                css: `background-image: url('${url}');`,
                markdown: `![${req.file.originalname}](${url})`,
                direct: url
            }
        });

    } catch (error) {
        console.error('❌ Erreur upload:', error);
        res.status(500).json({ 
            success: false, 
            message: `Erreur upload: ${error.message}` 
        });
    }
});

// Route pour lister les fichiers (pour admin)
app.get('/api/files', (req, res) => {
    try {
        console.log('📁 Liste fichiers demandée');
        
        fs.readdir(UPLOAD_DIR, (err, files) => {
            if (err) {
                console.error('❌ Erreur lecture dossier:', err);
                return res. status(500).json({ 
                    success: false,
                    error: "Erreur lecture dossier" 
                });
            }

            console.log(`📊 ${files.length} fichiers trouvés`);
            
            // Exclure les fichiers système
            const validFiles = files.filter(file => 
                !file.startsWith('.') && 
                !['.gitkeep', '.gitignore', '.DS_Store'].includes(file)
            );

            const fileList = validFiles.map(file => {
                try {
                    const filePath = path.join(UPLOAD_DIR, file);
                    const stats = fs.statSync(filePath);
                    const extension = path.extname(file).toLowerCase();
                    
                    // Déterminer le type
                    let type = 'other';
                    if(['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg']. includes(extension)) type = 'image';
                    else if(['.mp4','.webm','. mov','.avi','.mkv','.flv']. includes(extension)) type = 'video';
                    else if(['.mp3','.wav','.ogg','.m4a','.flac'].includes(extension)) type = 'audio';
                    else if(['.pdf','.doc','. docx','.txt','.rtf'].includes(extension)) type = 'document';
                    else if(['.zip','. rar','.7z','.tar','.gz'].includes(extension)) type = 'archive';
                    
                    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
                    const host = req.get('host');
                    const url = `${protocol}://${host}/uploads/${file}`;
                    
                    return {
                        name: file,
                        originalName: file,
                        url: url,
                        directUrl: url,
                        publicUrl: url,
                        downloadUrl: url,
                        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                        sizeBytes: stats.size,
                        date: stats.mtime,
                        lastModified: stats.mtime,
                        type: type,
                        contentType: 'application/octet-stream',
                        extension: extension,
                        usage: {
                            html: `<img src="${url}" alt="${file}">`,
                            css: `background-image: url('${url}');`,
                            markdown: `![${file}](${url})`
                        }
                    };
                } catch (e) {
                    console.error(`⚠️ Erreur stats pour ${file}:`, e.message);
                    return null;
                }
            }).filter(f => f !== null)
              .sort((a, b) => new Date(b.date) - new Date(a.date));

            console.log(`✅ ${fileList.length} fichiers traités`);
            
            res.json({
                success: true,
                files: fileList,
                total: fileList.length,
                uploadDir: UPLOAD_DIR,
                timestamp: new Date().toISOString()
            });
        });
        
    } catch (error) {
        console.error('❌ Erreur liste fichiers:', error);
        res.status(500).json({ 
            success: false,
            error: "Erreur lors de la récupération des fichiers"
        });
    }
});

// Route pour supprimer un fichier
app.delete('/api/files/:filename', (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);
        console.log(`🗑️ Suppression demandée: ${filename}`);
        
        // Sécurité: empêcher les chemins relatifs
        const safeFilename = path.basename(filename);
        const filePath = path.join(UPLOAD_DIR, safeFilename);
        
        if (!fs.existsSync(filePath)) {
            console.log(`❌ Fichier non trouvé: ${safeFilename}`);
            return res.status(404).json({ 
                success: false, 
                message: "Fichier introuvable" 
            });
        }
        
        fs.unlinkSync(filePath);
        console.log(`✅ Fichier supprimé: ${safeFilename}`);
        
        res.json({ 
            success: true, 
            message: "Fichier supprimé avec succès",
            filename: safeFilename
        });
        
    } catch (error) {
        console.error('❌ Erreur suppression:', error);
        res.status(500).json({ 
            success: false, 
            message: `Erreur lors de la suppression: ${error.message}` 
        });
    }
});

// Route pour les statistiques
app.get('/api/stats', (req, res) => {
    try {
        const files = fs.readdirSync(UPLOAD_DIR);
        const validFiles = files.filter(file => 
            !file.startsWith('.') && 
            !['.gitkeep', '.gitignore', '.DS_Store'].includes(file)
        );
        
        let totalSize = 0;
        const typeCount = { image: 0, video: 0, audio: 0, document: 0, other: 0 };
        
        validFiles.forEach(file => {
            try {
                const filePath = path.join(UPLOAD_DIR, file);
                const stats = fs. statSync(filePath);
                totalSize += stats.size;
                
                const extension = path.extname(file).toLowerCase();
                if(['.jpg','. jpeg','.png','.gif','.webp'].includes(extension)) typeCount.image++;
                else if(['. mp4','.webm','.mov','.avi']. includes(extension)) typeCount.video++;
                else if(['.mp3','.wav','.ogg']. includes(extension)) typeCount.audio++;
                else if(['. pdf','.doc','.docx','. txt'].includes(extension)) typeCount.document++;
                else typeCount. other++;
            } catch (e) {
                // Ignorer les erreurs sur un fichier
            }
        });
        
        res.json({
            success: true,
            stats: {
                totalFiles: validFiles.length,
                totalSize: (totalSize / 1024 / 1024).toFixed(2) + ' MB',
                storageUsed: (totalSize / 1024 / 1024).toFixed(2) + ' MB',
                byType: typeCount
            },
            uploadDir: UPLOAD_DIR,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erreur statistiques:', error);
        res.status(500).json({ 
            success: false,
            error: "Erreur lors du calcul des statistiques" 
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

// Route de test - Compatible cross-origin
app. get('/api/test', (req, res) => {
    console.log('🧪 Test serveur demandé');
    
    res.json({
        service: "Cloud Media Local",
        status: "running",
        storage: "Local Disk",
        maxFileSize: "2GB",
        crossOrigin: "enabled",
        cors: "all domains allowed",
        server: {
            port: PORT,
            uploadDir: UPLOAD_DIR,
            uptime: process.uptime()
        },
        compatibility: {
            html: "✅ Compatible <img src=''> ",
            css: "✅ Compatible background-image: url()",
            iframe: "✅ Compatible <iframe src=''>",
            embed: "✅ Compatible <embed src=''>",
            video: "✅ Compatible <video src=''>",
            audio: "✅ Compatible <audio src=''>",
            ajax: "✅ Compatible fetch() et XMLHttpRequest",
            cors: "✅ Tous domaines autorisés"
        },
        endpoints: {
            upload: "POST /upload",
            listFiles: "GET /api/files",
            deleteFile: "DELETE /api/files/:filename",
            stats: "GET /api/stats",
            login: "POST /api/login",
            test: "GET /api/test",
            health: "GET /api/health"
        }
    });
});

// Route racine
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cloud Media Server - Cross-Origin Compatible</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .container { max-width: 800px; margin: 0 auto; }
                .card { background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 10px 0; }
                .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 5px; }
                .btn:hover { background: #0056b3; }
                .code { background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 Cloud Media Server</h1>
                <p>Serveur de stockage média local - <strong>Compatible tous projets</strong></p>
                
                <div class="card">
                    <h2>📊 Serveur en fonctionnement</h2>
                    <p><strong>Port:</strong> ${PORT}</p>
                    <p><strong>Dossier upload:</strong> ${UPLOAD_DIR}</p>
                    <p><strong>Taille max fichier:</strong> 2GB</p>
                    <p><strong>CORS:</strong> ✅ Activé pour tous domaines</p>
                    <p><strong>Cross-Origin:</strong> ✅ Compatible</p>
                </div>
                
                <div class="card">
                    <h2>🔗 Liens rapides</h2>
                    <a class="btn" href="/index.html" target="_blank">Interface Upload</a>
                    <a class="btn" href="/admin.html" target="_blank">Interface Admin</a>
                    <a class="btn" href="/api/test" target="_blank">API Test</a>
                    <a class="btn" href="/api/files" target="_blank">Liste fichiers</a>
                </div>
                
                <div class="card">
                    <h2>🌐 Compatibilité Cross-Origin</h2>
                    <p>✅ Utilisable dans <strong>n'importe quel projet</strong></p>
                    <div class="code">
                        &lt;img src="https://ton-app.onrender.com/uploads/image.jpg"&gt;<br>
                        background-image: url('https://ton-app.onrender.com/uploads/bg.jpg');<br>
                        &lt;video src="https://ton-app.onrender. com/uploads/video.mp4"&gt;&lt;/video&gt;
                    </div>
                </div>
                
                <div class="card">
                    <h2>📚 Documentation API</h2>
                    <ul>
                        <li><strong>POST /upload</strong> - Uploader un fichier</li>
                        <li><strong>GET /api/files</strong> - Lister les fichiers</li>
                        <li><strong>DELETE /api/files/:filename</strong> - Supprimer un fichier</li>
                        <li><strong>GET /api/stats</strong> - Statistiques</li>
                        <li><strong>POST /api/login</strong> - Login admin</li>
                        <li><strong>GET /api/test</strong> - Tester le serveur</li>
                    </ul>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Gestion des erreurs 404
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
            "GET /api/test",
            "GET /api/health"
        ]
    });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
    console.error('💥 ERREUR SERVEUR:', err);
    res.status(500).json({
        success: false,
        message: "Erreur serveur interne",
        error: err.message
    });
});

// --- DÉMARRAGE SERVEUR ---
app.listen(PORT, () => {
    console.log(`\n🚀 ===========================================`);
    console.log(`🚀 Serveur Cloud Media lancé sur http://localhost:${PORT}`);
    console.log(`🚀 ===========================================\n`);
    console.log(`📋 CONFIGURATION:`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Dossier upload: ${UPLOAD_DIR}`);
    console.log(`   Taille max: 2GB`);
    console.log(`   CORS: ✅ Tous domaines autorisés`);
    console.log(`   Cross-Origin: ✅ Compatible\n`);
    
    console.log(`🔍 VÉRIFICATIONS:`);
    console.log(`   ✅ Serveur démarré`);
    console. log(`   ✅ CORS activé pour tous projets`);
    console.log(`   ✅ Headers cross-origin configurés`);
    console.log(`   ✅ Dossier upload: ${fs.existsSync(UPLOAD_DIR) ? '✅' : '❌'}`);
    console.log(`   ✅ Middleware statique configuré`);
    console.log(`   ✅ Compatible <img>, <video>, <audio>, CSS\n`);
    
    console.log(`🌐 LIENS:`);
    console.log(`   👉 Interface: http://localhost:${PORT}`);
    console. log(`   👉 Upload: http://localhost:${PORT}/index.html`);
    console.log(`   👉 Admin: http://localhost:${PORT}/admin.html`);
    console.log(`   👉 API Test: http://localhost:${PORT}/api/test\n`);
    
    console.log(`💡 POUR TESTER:`);
    console.log(`   curl http://localhost:${PORT}/api/test`);
    console. log(`   curl -X POST -F "file=@test. jpg" http://localhost:${PORT}/upload\n`);
    
    console.log(`🎯 COMPATIBILITÉ:`);
    console.log(`   ✅ HTML: <img src="URL">`);
    console.log(`   ✅ CSS: background-image: url('URL')`);
    console.log(`   ✅ Video: <video src="URL">`);
    console.log(`   ✅ Audio: <audio src="URL">`);
    console.log(`   ✅ Iframe: <iframe src="URL">`);
    console.log(`   ✅ Fetch/Ajax depuis n'importe quel domaine\n`);
});
