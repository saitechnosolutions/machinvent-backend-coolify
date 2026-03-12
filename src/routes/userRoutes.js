const express = require('express');
const router  = express.Router();
const userCtrl = require('../controllers/userController');
const authToken  = require('../middleware/authMiddleware');

router.get('/', authToken,     userCtrl.getUsers);    

router.get('/:id', authToken,   userCtrl.getUserById); 
router.put('/:id', authToken,   userCtrl.updateUser);  
router.delete('/me', authToken, userCtrl.deleteUser);  
router.post('/:id/restore',    userCtrl.restoreUser);      
router.delete('/:id/force',    userCtrl.forceDeleteUser);

module.exports = router;
