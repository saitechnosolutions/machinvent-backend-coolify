const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/profiles/');
  },
  filename: function (req, file, cb) {
    // Generate unique filename with original extension
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {

  // Check if it's an image by MIME type
  if (file.mimetype.startsWith('image/')) {
    console.log('File accepted by MIME type');
    cb(null, true);
  } 
  // Check if it's an image by file extension
  else if (file.originalname) {
    const ext = path.extname(file.originalname).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    
    if (imageExtensions.includes(ext)) {
      console.log('File accepted by extension:', ext);
      cb(null, true);
    } else {
      console.log('File rejected - not an image extension:', ext);
      cb(new Error('Only image files are allowed!'), false);
    }
  } else {
    console.log('File rejected - no MIME type or extension');
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

module.exports = upload; 