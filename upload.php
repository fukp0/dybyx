<?php
// upload.php
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *"); // Permet l'accès API depuis d'autres sites

// Configuration
$uploadDir = 'uploads/';
$baseUrl = 'http://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']) . '/' . $uploadDir;
$maxSize = 50 * 1024 * 1024; // 50MB (Attention à la config php.ini upload_max_filesize)

// Extensions autorisées par type
$allowedTypes = [
    'image' => ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    'video' => ['mp4', 'webm', 'ogg', 'mov'],
    'audio' => ['mp3', 'wav', 'ogg']
];

$response = ['success' => false];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $file = $_FILES['file'];
    $fileName = $file['name'];
    $fileTmp = $file['tmp_name'];
    $fileSize = $file['size'];
    $fileError = $file['error'];

    // Récupérer l'extension
    $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    // Aplatir la liste des extensions autorisées pour vérification
    $allAllowed = array_merge(...array_values($allowedTypes));

    // Vérifications de base
    if ($fileError === 0) {
        if ($fileSize <= $maxSize) {
            if (in_array($fileExt, $allAllowed)) {
                
                // Générer un nom unique pour éviter les écrasements
                $newFileName = uniqid('', true) . "." . $fileExt;
                $fileDestination = $uploadDir . $newFileName;

                // Déplacer le fichier
                if (move_uploaded_file($fileTmp, $fileDestination)) {
                    $response['success'] = true;
                    $response['url'] = $baseUrl . $newFileName;
                    $response['type'] = mime_content_type($fileDestination);
                    $response['message'] = "Fichier uploadé avec succès !";
                } else {
                    $response['message'] = "Erreur lors de l'enregistrement sur le serveur.";
                }
            } else {
                $response['message'] = "Type de fichier non autorisé.";
            }
        } else {
            $response['message'] = "Fichier trop volumineux (Max 50MB).";
        }
    } else {
        $response['message'] = "Erreur lors du transfert (Code: $fileError).";
    }
} else {
    $response['message'] = "Aucun fichier envoyé.";
}

echo json_encode($response);
?>
