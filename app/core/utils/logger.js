class Logger {
    constructor() {
        this.colors = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            warning: '\x1b[33m',
            error: '\x1b[31m',
            reset: '\x1b[0m'
        };
    }

    log(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const color = this.colors[level] || this.colors.info;
        
        console.log(
            `${color}[${timestamp}] [${level.toUpperCase()}]${this.colors.reset} ${message}`,
            ...args
        );
    }

    info(message, ...args) {
        this.log('info', message, ...args);
    }

    success(message, ...args) {
        this.log('success', message, ...args);
    }

    warning(message, ...args) {
        this.log('warning', message, ...args);
    }

    error(message, ...args) {
        this.log('error', message, ...args);
    }

    // Для создания дочерних логгеров (например, для модулей)
    child(context) {
        return {
            info: (msg, ...args) => this.info(`[${JSON.stringify(context)}] ${msg}`, ...args),
            success: (msg, ...args) => this.success(`[${JSON.stringify(context)}] ${msg}`, ...args),
            warning: (msg, ...args) => this.warning(`[${JSON.stringify(context)}] ${msg}`, ...args),
            error: (msg, ...args) => this.error(`[${JSON.stringify(context)}] ${msg}`, ...args)
        };
    }
}

module.exports = new Logger();