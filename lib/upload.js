// Multer handles multipart/form-data for file uploads in Express
const multer = require("multer");
const path = require("path"); // Node.js path utilities
const { v4: uuidv4 } = require("uuid"); // UUID generator for unique filenames
const fs = require("fs"); // File system operations

// List of upload directories that must exist before the app starts
const uploadDirs = [
    "uploads/profiles", // Alumni profile images
    "uploads/cv", // CV/resume uploads
    "uploads/documents", // General document uploads
    "uploads/temp", // Temporary file storage
];

// Create each upload directory if it doesn't already exist
uploadDirs.forEach((dir) => {
    const fullPath = path.join(__dirname, "..", dir); // Resolve path relative to project root
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true }); // Create directory and any missing parent dirs
    }
});

// Configure disk storage for profile images with UUID-based filenames
const profileImageStorage = multer.diskStorage({
    // Set the destination folder for uploaded profile images
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "..", "uploads/profiles"));
    },
    // Generate a unique filename using UUID to prevent collisions and path traversal
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase(); // Preserve original extension
        cb(null, `${uuidv4()}${ext}`); // e.g. "a1b2c3d4-e5f6-...jpg"
    },
});

/**
 * File filter function to restrict uploads to image files only.
 * Validates both the file extension and MIME type for security.
 * @param {object} req - Express request
 * @param {object} file - Uploaded file metadata
 * @param {Function} cb - Multer callback (null, true) to accept or Error to reject
 */
function imageFilter(req, file, cb) {
    // Regex pattern matching allowed image formats
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    // Check that the file extension matches an allowed image type
    const extValid = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
    );
    // Check that the MIME type also matches (prevents extension spoofing)
    const mimeValid = allowedTypes.test(file.mimetype);

    if (extValid && mimeValid) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error(
            "Only image files (jpeg, jpg, png, gif, webp) are allowed"
        ));
    }
}

// Configured multer instance for profile image uploads
const uploadProfileImage = multer({
    storage: profileImageStorage, // Use UUID disk storage defined above
    fileFilter: imageFilter, // Only accept image files
    limits: { fileSize: 5 * 1024 * 1024 }, // Maximum file size: 5MB
});

module.exports = {
    uploadProfileImage,
};
