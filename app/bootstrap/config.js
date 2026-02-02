// app/bootstrap/config.js
const fs = require('fs');
const path = require('path');
const logger = require('../core/utils/logger');

class ConfigLoader {
    constructor() {
        this.modules = {};
        this.globalConfig = this.loadGlobalConfig();
    }
    
    loadGlobalConfig() {
        try {
            // Пытаемся загрузить конфиг из .env или других источников
            return {
                environment: process.env.NODE_ENV || 'development',
                port: process.env.PORT || 3000,
                dataDir: path.join(__dirname, '../../..', 'nft_data'),
                publicDir: path.join(__dirname, '../../..', 'public')
            };
        } catch (error) {
            logger.error('Ошибка загрузки глобальной конфигурации:', error);
            return {};
        }
    }
    
    loadModules() {
        const modulesPath = path.join(__dirname, '../modules');
        
        // Проверяем существует ли директория modules
        if (!fs.existsSync(modulesPath)) {
            logger.warning('Директория modules не найдена');
            return this.modules;
        }
        
        const moduleDirs = fs.readdirSync(modulesPath);
        
        moduleDirs.forEach(moduleDir => {
            const modulePath = path.join(modulesPath, moduleDir);
            
            if (fs.statSync(modulePath).isDirectory()) {
                this.loadModule(moduleDir, modulePath);
            }
        });
        
        logger.info(`Загружено ${Object.keys(this.modules).length} модулей`);
        return this.modules;
    }
    
    loadModule(moduleName, modulePath) {
        const configPath = path.join(modulePath, `${moduleName}.config.js`);
        
        if (!fs.existsSync(configPath)) {
            logger.warning(`Модуль "${moduleName}" не имеет конфигурации (файл ${moduleName}.config.js не найден)`);
            return;
        }
        
        try {
            const moduleConfig = require(configPath);
            
            // Проверяем, включен ли модуль
            if (moduleConfig.enabled === false) {
                logger.info(`Модуль "${moduleName}" отключен в конфигурации`);
                return;
            }
            
            // Дополняем конфиг стандартными полями
            const enhancedConfig = {
                name: moduleName,
                path: modulePath,
                enabled: true,
                version: moduleConfig.version || '1.0.0',
                routesPrefix: moduleConfig.routesPrefix || `/api/${moduleName}`,
                description: moduleConfig.description || `Модуль ${moduleName}`,
                ...moduleConfig
            };
            
            this.modules[moduleName] = {
                name: moduleName,
                config: enhancedConfig,
                path: modulePath,
                hasRoutes: fs.existsSync(path.join(modulePath, `${moduleName}.routes.js`)),
                hasController: fs.existsSync(path.join(modulePath, `${moduleName}.controller.js`)),
                hasService: fs.existsSync(path.join(modulePath, `${moduleName}.service.js`))
            };
            
            logger.success(`Модуль "${moduleName}" v${enhancedConfig.version} загружен`);
            
        } catch (error) {
            logger.error(`Ошибка загрузки модуля "${moduleName}":`, error.message);
        }
    }
    
    getModuleConfig(moduleName) {
        return this.modules[moduleName]?.config;
    }
    
    getModules() {
        return this.modules;
    }
    
    isModuleEnabled(moduleName) {
        return this.modules[moduleName]?.config?.enabled === true;
    }
}

module.exports = new ConfigLoader();