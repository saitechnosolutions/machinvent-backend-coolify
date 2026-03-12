// utils/adminTokenUtils.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.generateAdminAccessToken = (admin) => {
  return jwt.sign(
    { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    process.env.ADMIN_ACCESS_TOKEN_SECRET,
    { expiresIn: '6h' } 
  );
};
