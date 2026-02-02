// Базовый обработчик файлов
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class FileHandler {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 минут
    }

    async readFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return data;
        } catch (error) {
            logger.error(`Ошибка чтения файла ${filePath}:`, error);
            throw error;
        }
    }

    async readJSON(filePath) {
        try {
            const data = await this.readFile(filePath);
            return JSON.parse(data);
        } catch (error) {
            logger.error(`Ошибка парсинга JSON ${filePath}:`, error);
            throw error;
        }
    }

    async writeFile(filePath, data) {
        try {
            await fs.writeFile(filePath, data, 'utf8');
            logger.info(`Файл сохранен: ${path.basename(filePath)}`);
            return true;
        } catch (error) {
            logger.error(`Ошибка записи файла ${filePath}:`, error);
            throw error;
        }
    }

    async writeJSON(filePath, data) {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            return await this.writeFile(filePath, jsonString);
        } catch (error) {
            logger.error(`Ошибка записи JSON ${filePath}:`, error);
            throw error;
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    clearCache() {
        this.cache.clear();
        logger.info('Кэш файлов очищен');
    }
}

module.exports = new FileHandler();