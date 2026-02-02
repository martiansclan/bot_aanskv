// Маршруты модуля сортировки
const express = require('express');
const router = express.Router();
const sortController = require('./sort.controller');

// Получение опций фильтрации
router.get('/filter-options', (req, res) => sortController.getFilterOptions(req, res));

// Сортировка NFT
router.post('/sort', (req, res) => sortController.sortNFTs(req, res));

// Быстрый поиск
router.get('/quick-search', (req, res) => sortController.quickSearch(req, res));

module.exports = router;