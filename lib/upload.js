const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

// Ensure upload directories exist
const uploadDirs = [
    "uploads/profiles",
    "uploads/cv",
    "uploads/documents",
    "uploads/temp",
];

uploadDirs.forEach((dir) => {
    const fullPath = path.join(__dirname, "..", dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

// Storage configuration with UUID filenames
const profileImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "..", "uploads/profiles"));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
    },
});

/**
 * File filter: only allow image files
 */
function imageFilter(req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extValid = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimeValid = allowedTypes.test(file.mimetype);

    if (extValid && mimeValid) {
        cb(null, true);
    } else {
        cb(new Error(
            "Only image files (jpeg, jpg, png, gif, webp) are allowed"
        ));
    }
}

const uploadProfileImage = multer({
    storage: profileImageStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

module.exports = {
    uploadProfileImage,
};
