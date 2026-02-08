class WalletCollector {
    constructor() {
        this.baseUrl = '/api/TribeWalletInfoCollector';
        this.walletCount = 1;
        this.currentFile = null;
        
        this.init();
    }

    init() {
        this.initElements();
        this.bindEvents();
        this.setupDragAndDrop();
        this.switchTab('upload');
        this.addWalletRow(); // Add first wallet row for manual input
    }

    initElements() {
        this.elements = {
            walletRows: document.getElementById('walletRows'),
            addWalletBtn: document.getElementById('addWalletBtn'),
            collectBtn: document.getElementById('collectBtn'),
            userId: document.getElementById('userId'),
            loading: document.getElementById('loading'),
            results: document.getElementById('results'),
            uploadArea: document.getElementById('uploadArea'),
            fileInput: document.getElementById('fileInput'),
            fileInfo: document.getElementById('fileInfo'),
            fileName: document.getElementById('fileName'),
            fileSize: document.getElementById('fileSize'),
            loadingDetails: document.getElementById('loadingDetails'),
            updateFileCheckbox: document.getElementById('updateFileCheckbox')
        };
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Manual input
        this.elements.addWalletBtn.addEventListener('click', () => this.addWalletRow());
        this.elements.collectBtn.addEventListener('click', () => this.processRequest());
        
        // File upload
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Enter key support
        this.elements.userId.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.processRequest();
        });
    }

    setupDragAndDrop() {
        const uploadArea = this.elements.uploadArea;
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#667eea';
            uploadArea.style.background = '#edf2f7';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#cbd5e0';
            uploadArea.style.background = '#f7fafc';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#cbd5e0';
            uploadArea.style.background = '#f7fafc';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}Tab`);
        });
    }

    addWalletRow() {
        const rowId = this.walletCount++;
        const row = document.createElement('div');
        row.className = 'wallet-row';
        row.innerHTML = `
            <div class="wallet-input-group">
                <input 
                    type="text" 
                    class="wallet-input"
                    placeholder="TON wallet address (e.g., UQBMgPJiyNl4Tg0LXm8s6adOpob0tact5xAgBtaVpmvk50zM)"
                    data-id="${rowId}"
                    autocomplete="off"
                >
            </div>
            ${rowId > 1 ? `
                <button type="button" class="remove-wallet-btn" onclick="window.walletCollector.removeWalletRow(${rowId})">
                    <i class="fas fa-times"></i>
                </button>
            ` : ''}
        `;
        
        // Add Enter key support
        const walletInput = row.querySelector('.wallet-input');
        
        walletInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.processRequest();
        });
        
        this.elements.walletRows.appendChild(row);
        
        // Focus on the new input
        walletInput.focus();
    }

    removeWalletRow(id) {
        const row = document.querySelector(`.wallet-row input[data-id="${id}"]`)?.closest('.wallet-row');
        if (row) {
            row.remove();
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    handleFile(file) {
        if (!file.name.endsWith('.json')) {
            this.showError('Please select a JSON file');
            return;
        }

        this.currentFile = file;
        
        // Show file info
        this.elements.fileName.textContent = file.name;
        this.elements.fileSize.textContent = this.formatFileSize(file.size);
        this.elements.fileInfo.style.display = 'flex';
        
        // Switch to upload tab if not already
        this.switchTab('upload');
        
        this.showNotification('File ready for upload', 'success');
    }

    async uploadFile() {
        if (!this.currentFile) {
            this.showError('No file selected');
            return;
        }

        const userId = this.validateUserId();
        if (!userId) return;

        const formData = new FormData();
        formData.append('file', this.currentFile);
        formData.append('userId', userId);

        try {
            this.elements.loading.style.display = 'flex';
            this.elements.loadingDetails.textContent = 'Uploading file...';
            this.elements.collectBtn.disabled = true;

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`Uploaded ${data.walletsCount} wallets from file`, 'success');
                
                // Switch to manual tab to show we're ready
                this.switchTab('manual');
                
                // Show results
                this.showResults(data, userId);
            } else {
                this.showError(data.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Upload error:', error);
            this.showError(`Upload error: ${error.message}`);
        } finally {
            this.elements.loading.style.display = 'none';
            this.elements.collectBtn.disabled = false;
        }
    }

    getWalletsData() {
        const wallets = [];
        
        // Check current tab
        const isManualTab = document.getElementById('manualTab').classList.contains('active');
        
        if (isManualTab) {
            // Get from manual input
            const inputs = document.querySelectorAll('.wallet-input');
            inputs.forEach(input => {
                const walletAddress = input.value.trim();
                if (walletAddress) {
                    wallets.push(walletAddress);
                }
            });
        } else {
            // File was uploaded, but we need to send empty array to use file
            return [];
        }
        
        return wallets;
    }

    validateUserId() {
        const userId = this.elements.userId.value.trim();
        if (!userId) {
            this.showError('Please enter User ID');
            this.elements.userId.focus();
            return false;
        }
        
        // Basic validation - alphanumeric and underscores
        const validUserId = /^[A-Za-z0-9_]+$/.test(userId);
        if (!validUserId) {
            this.showError('User ID can only contain letters, numbers and underscores');
            this.elements.userId.focus();
            return false;
        }
        
        return userId;
    }

    validateWalletsData() {
        // For manual tab, validate inputs
        const isManualTab = document.getElementById('manualTab').classList.contains('active');
        
        if (isManualTab) {
            const wallets = this.getWalletsData();
            if (wallets.length === 0) {
                this.showError('Please add at least one wallet address');
                document.querySelector('.wallet-input')?.focus();
                return false;
            }

            // Check for valid TON addresses
            for (const wallet of wallets) {
                if (!this.isValidTonAddress(wallet)) {
                    this.showError(`Invalid TON wallet address: ${wallet}`);
                    return false;
                }
            }

            return wallets;
        }
        
        // For upload tab, we'll use the file
        return [];
    }

    isValidTonAddress(address) {
        if (typeof address !== 'string') return false;
        
        // TON addresses are 48 characters long
        const tonAddressRegex = /^[a-zA-Z0-9_-]{48}$/;
        return tonAddressRegex.test(address);
    }

    async processRequest() {
        const userId = this.validateUserId();
        if (!userId) return;

        // Если выбрана вкладка загрузки и есть файл - загружаем файл
        const isUploadTab = document.getElementById('uploadTab').classList.contains('active');
        if (isUploadTab && this.currentFile) {
            return this.uploadFile();
        }

        // Иначе собираем данные
        return this.collectData();
    }

    async collectData() {
        const userId = this.validateUserId();
        if (!userId) return;

        const wallets = this.validateWalletsData();
        const updateFile = this.elements.updateFileCheckbox.checked;

        this.elements.loading.style.display = 'flex';
        this.elements.loadingDetails.textContent = 'Starting data collection...';
        this.elements.collectBtn.disabled = true;
        this.elements.results.className = 'results';

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    wallets,
                    updateFile
                })
            });

            const data = await response.json();
            this.showResults(data, userId);

        } catch (error) {
            console.error('Error:', error);
            this.showError(`Network error: ${error.message}`);
        } finally {
            this.elements.loading.style.display = 'none';
            this.elements.collectBtn.disabled = false;
        }
    }

    showResults(data, userId) {
        this.elements.results.innerHTML = '';
        
        if (data.success) {
            this.elements.results.innerHTML = `
                <div class="result-success">
                    <i class="fas fa-check-circle"></i> 
                    <span>Data collected successfully!</span>
                </div>
                <div class="file-info">
                    <div>
                        <i class="fas fa-file"></i>
                        <strong>File saved as:</strong> wallets_nft_info_${userId}.json
                    </div>
                    <div>
                        <i class="fas fa-folder"></i>
                        <small>Location: nft_data/user_files/</small>
                    </div>
                </div>
                <div class="result-details">
                    <strong>Summary:</strong><br>
                    • Source: ${data.source === 'request' ? 'Manual input' : 'File'}<br>
                    • Total wallets: ${data.total || 0}<br>
                    • Successfully processed: ${data.processed || 0}<br>
                    • Failed: ${data.failed || 0}
                    ${data.fileUpdated ? '<br>• Wallets file updated' : ''}
                </div>
            `;
            
            // Show details of failed wallets if any
            if (data.failed > 0 && data.results) {
                const failedWallets = data.results.filter(r => !r.success);
                if (failedWallets.length > 0) {
                    const failedDetails = failedWallets.map(w => 
                        `• ${w.nickname} (${w.wallet}): ${w.error}`
                    ).join('<br>');
                    
                    this.elements.results.innerHTML += `
                        <div class="result-details" style="margin-top: 10px; background: #fff5f5; border-color: #fc8181;">
                            <strong>Failed wallets:</strong><br>
                            ${failedDetails}
                        </div>
                    `;
                }
            }
            
            // Add download buttons
            this.elements.results.innerHTML += `
                <div class="file-actions">
                    <button id="downloadNftBtn" class="file-btn">
                        <i class="fas fa-download"></i> Download NFT Data
                    </button>
                    <button id="downloadWalletsBtn" class="file-btn secondary">
                        <i class="fas fa-download"></i> Download Wallets File
                    </button>
                </div>
            `;
            
            // Add download functionality
            document.getElementById('downloadNftBtn').addEventListener('click', () => {
                this.downloadFile(userId, 'nft');
            });
            
            document.getElementById('downloadWalletsBtn').addEventListener('click', () => {
                this.downloadFile(userId, 'wallets');
            });
        } else {
            this.elements.results.innerHTML = `
                <div class="result-error">
                    <i class="fas fa-exclamation-circle"></i> 
                    <span>Error: ${data.error || 'Unknown error'}</span>
                </div>
            `;
        }
        
        this.elements.results.className = 'results show';
        
        // Scroll to results
        this.elements.results.scrollIntoView({ behavior: 'smooth' });
    }

    async downloadFile(userId, type = 'nft') {
        try {
            const response = await fetch(`${this.baseUrl}/download/${userId}/${type}`);
            
            if (!response.ok) {
                throw new Error('File not found');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const filename = type === 'nft' ? `wallets_nft_info_${userId}.json` : `wallets_info_${userId}.json`;
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showNotification(`File downloaded: ${filename}`, 'success');
            
        } catch (error) {
            this.showError(`Download error: ${error.message}`);
        }
    }

    showError(message) {
        this.elements.results.innerHTML = `
            <div class="result-error">
                <i class="fas fa-exclamation-circle"></i> 
                <span>${message}</span>
            </div>
        `;
        this.elements.results.className = 'results show';
        
        // Scroll to error
        this.elements.results.scrollIntoView({ behavior: 'smooth' });
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.walletCollector = new WalletCollector();
});