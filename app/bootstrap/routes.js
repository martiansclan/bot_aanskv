// Сборка всех маршрутов
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const configLoader = require('./config');

class RouteLoader {
    constructor() {
        this.router = router;
        this.modules = configLoader.modules;
    }
    
    loadRoutes() {
        console.log('='.repeat(50));
        console.log('🛣️  Загрузка маршрутов...');
        
        // Загрузка маршрутов каждого модуля
        Object.values(this.modules).forEach(module => {
            try {
                const routesPath = path.join(module.path, `${module.name}.routes.js`);
                
                if (fs.existsSync(routesPath)) {
                    const moduleRoutes = require(routesPath);
                    const prefix = module.config.routesPrefix || `/api/${module.name}`;
                    
                    this.router.use(prefix, moduleRoutes);
                    console.log(`✅ "${module.name}" -> "${prefix}"`);
                } else {
                    console.warn(`⚠️ Модуль "${module.name}" не имеет файла маршрутов`);
                }
            } catch (error) {
                console.error(`❌ Ошибка загрузки маршрутов модуля "${module.name}":`, error.message);
            }
        });
        
        // Статические страницы модулей
        Object.values(this.modules).forEach(module => {
            const pagePath = path.join(__dirname, '../../public', `${module.name}.html`);
            
            if (fs.existsSync(pagePath)) {
                this.router.get(`/${module.name}`, (req, res) => {
                    res.sendFile(`${module.name}.html`, { root: './public' });
                });
                console.log(`✅ Страница модуля: "/${module.name}"`);
            }
        });
        
        // Главная страница
        this.router.get('/', (req, res) => {
            res.sendFile('index.html', { root: './public' });
        });
        
        console.log('='.repeat(50));
        
        return this.router;
    }
}

module.exports = new RouteLoader();