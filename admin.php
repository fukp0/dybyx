<?php
session_start();

// --- CONFIGURATION ---
$password = "admin123"; // CHANGE CE MOT DE PASSE !!!
$uploadDir = 'uploads/';
// ---------------------

// Gestion Login
if (isset($_POST['login'])) {
    if ($_POST['pass'] === $password) {
        $_SESSION['admin_logged'] = true;
    } else {
        $error = "Mauvais mot de passe.";
    }
}

// Gestion Logout
if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: admin.php");
    exit;
}

// Gestion Suppression
if (isset($_GET['delete']) && isset($_SESSION['admin_logged'])) {
    $fileToDelete = basename($_GET['delete']);
    $filePath = $uploadDir . $fileToDelete;
    if (file_exists($filePath)) {
        unlink($filePath);
        $msg = "Fichier supprimé.";
    }
}

?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Administration Média</title>
    <style>
        body { font-family: sans-serif; background: #f4f6f8; padding: 20px; }
        .login-box { max-width: 300px; margin: 50px auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); text-align: center; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; }
        .card { background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: center; overflow: hidden; }
        .card img, .card video { width: 100%; height: 100px; object-fit: cover; border-radius: 4px; }
        .card a { display: block; margin-top: 5px; color: red; text-decoration: none; font-size: 0.8rem; border: 1px solid red; padding: 2px; border-radius: 4px; }
        .card a:hover { background: red; color: white; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        input { padding: 10px; margin-bottom: 10px; width: 80%; }
        button { padding: 10px 20px; background: #4F46E5; color: white; border: none; cursor: pointer; border-radius: 4px; }
    </style>
</head>
<body>

<?php if (!isset($_SESSION['admin_logged'])): ?>
    <div class="login-box">
        <h2>Connexion Admin</h2>
        <?php if(isset($error)) echo "<p style='color:red'>$error</p>"; ?>
        <form method="post">
            <input type="password" name="pass" placeholder="Mot de passe" required>
            <button type="submit" name="login">Entrer</button>
        </form>
        <p><a href="index.html">Retour au site</a></p>
    </div>
<?php else: ?>

    <div class="top-bar">
        <h1>Gestion des Fichiers</h1>
        <div>
            <a href="index.html" style="margin-right: 15px;">Voir le site</a>
            <a href="?logout=true" style="color: red;">Déconnexion</a>
        </div>
    </div>

    <?php if(isset($msg)) echo "<p style='color:green'>$msg</p>"; ?>

    <div class="grid">
        <?php
        $files = array_diff(scandir($uploadDir), array('.', '..', '.htaccess'));
        
        if(count($files) == 0) echo "<p>Aucun fichier uploadé.</p>";

        foreach($files as $file):
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            $path = $uploadDir . $file;
        ?>
            <div class="card">
                <?php if(in_array($ext, ['jpg','jpeg','png','gif','webp'])): ?>
                    <img src="<?php echo $path; ?>">
                <?php elseif(in_array($ext, ['mp4','webm'])): ?>
                    <video src="<?php echo $path; ?>"></video>
                <?php else: ?>
                    <div style="height:100px; display:flex; align-items:center; justify-content:center; background:#eee;">🎵/📁</div>
                <?php endif; ?>
                
                <div style="font-size:0.7rem; margin:5px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><?php echo $file; ?></div>
                <a href="?delete=<?php echo $file; ?>" onclick="return confirm('Supprimer ce fichier ?')">Supprimer</a>
                <a href="<?php echo $path; ?>" target="_blank" style="border-color:#4F46E5; color:#4F46E5; margin-top:2px;">Voir</a>
            </div>
        <?php endforeach; ?>
    </div>

<?php endif; ?>

</body>
</html>
