const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

router.post('/telegram-login', authController.telegramLogin);
router.get('/check-session', authController.checkSession);
router.post('/logout', authController.logout);
router.get('/modules-config', authController.getModulesConfig);

module.exports = router;