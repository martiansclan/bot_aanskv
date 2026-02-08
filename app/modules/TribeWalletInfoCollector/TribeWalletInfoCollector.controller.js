// app/modules/TribeWalletInfoCollector/TribeWalletInfoCollector.controller.js
const service = require('./TribeWalletInfoCollector.service.js');
const fs = require('fs').promises;
const path = require('path');
const config = require('./TribeWalletInfoCollector.config.js');

class TribeWalletInfoCollectorController {
    /**
     * Сбор информации о кошельках и сохранение в файл
     */
    async collectWalletsInfo(req, res) {
        try {
            const { wallets, userId, updateFile } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Не указан ID пользователя'
                });
            }

            let walletsToProcess = [];
            let fileUpdated = false;
            let source = '';

            // Если есть кошельки в запросе
            if (wallets && Array.isArray(wallets) && wallets.length > 0) {
                const validWallets = wallets.filter(w => w && service.isValidTonAddress(w));
                
                if (validWallets.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Нет валидных адресов кошельков'
                    });
                }

                walletsToProcess = validWallets;
                source = 'request';
                
                // Если нужно обновить файл
                if (updateFile) {
                    await service.saveWalletsToFile(validWallets, userId);
                    fileUpdated = true;
                }
            } 
            // Если кошельков нет в запросе, пытаемся загрузить из файла
            else {
                walletsToProcess = await service.loadWalletsFromFile(userId);
                
                if (walletsToProcess.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Нет кошельков для обработки. Загрузите кошельки в файл или укажите в запросе.'
                    });
                }
                
                source = 'file';
            }

            const result = await service.collectAndSaveWalletsInfo(walletsToProcess, userId);

            res.json({
                success: true,
                userId,
                fileUpdated,
                source,
                message: 'Данные успешно собраны и сохранены',
                ...result
            });

        } catch (error) {
            console.error('Ошибка сбора данных:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Внутренняя ошибка сервера'
            });
        }
    }

    /**
     * Загрузка файла с кошельками
     */
    async uploadWalletsFile(req, res) {
        try {
            const { userId } = req.body;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Не указан ID пользователя'
                });
            }

            if (!req.files || !req.files.file) {
                return res.status(400).json({
                    success: false,
                    error: 'Файл не загружен'
                });
            }

            const file = req.files.file;
            
            // Проверяем расширение файла
            if (!file.name.endsWith('.json')) {
                return res.status(400).json({
                    success: false,
                    error: 'Файл должен быть в формате JSON'
                });
            }

            // Сохраняем файл
            const fileName = `wallets_info_${userId}.json`;
            const filePath = path.join(config.dataDir, fileName);
            
            // Используем mv метод для сохранения файла
            await file.mv(filePath);
            
            // Проверяем содержимое файла
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(fileContent);
            
            if (!data.members || !Array.isArray(data.members)) {
                // Удаляем невалидный файл
                await fs.unlink(filePath);
                return res.status(400).json({
                    success: false,
                    error: 'Неверный формат файла. Ожидается структура с полем "members"'
                });
            }

            // Извлекаем и валидируем адреса
            const wallets = data.members
                .map(member => member.Wallet)
                .filter(wallet => wallet && service.isValidTonAddress(wallet));

            if (wallets.length === 0) {
                // Удаляем файл без валидных адресов
                await fs.unlink(filePath);
                return res.status(400).json({
                    success: false,
                    error: 'В файле нет валидных адресов TON кошельков'
                });
            }

            res.json({
                success: true,
                userId,
                fileName,
                walletsCount: wallets.length,
                message: `Загружено ${wallets.length} кошельков`
            });

        } catch (error) {
            console.error('Ошибка загрузки файла:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Внутренняя ошибка сервера'
            });
        }
    }

    /**
     * Скачивание файла с данными
     */
    async downloadFile(req, res) {
        try {
            const { userId, type } = req.params;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Не указан ID пользователя'
                });
            }

            let fileName, filePath;
            
            if (type === 'nft') {
                fileName = `wallets_nft_info_${userId}.json`;
            } else if (type === 'wallets') {
                fileName = `wallets_info_${userId}.json`;
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Не указан тип файла (nft или wallets)'
                });
            }
            
            filePath = path.join(config.dataDir, fileName);

            // Проверяем существование файла
            try {
                await fs.access(filePath);
            } catch {
                return res.status(404).json({
                    success: false,
                    error: 'Файл не найден'
                });
            }

            // Отправляем файл
            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Ошибка скачивания файла:', err);
                    res.status(500).json({
                        success: false,
                        error: 'Ошибка при скачивании файла'
                    });
                }
            });

        } catch (error) {
            console.error('Ошибка скачивания:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Внутренняя ошибка сервера'
            });
        }
    }

    /**
     * Проверка работоспособности модуля
     */
    async healthCheck(req, res) {
        try {
            const health = await service.healthCheck();
            res.json(health);
        } catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                error: error.message
            });
        }
    }
}

module.exports = new TribeWalletInfoCollectorController();