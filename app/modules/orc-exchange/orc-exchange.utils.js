const constants = require('./power.constants');

class Orc {
    constructor(id, type, power, earrings, logo, bracelet = '') {
        this.id = id;
        this.type = type;
        this.power = power;
        this.earrings = earrings;
        this.logos = logo; // ОРИГИНАЛЬНОЕ ЗНАЧЕНИЕ
        this.bracelet = bracelet;
        this.typeName = constants.ORC_TYPE_NAMES[type] || `Тип ${type}`;
        this.ownerId = null;
    }
}

class Team {
    constructor(orcs) {
        this.orcs = orcs;
        this.totalPower = this.calculatePower();
    }

    calculatePower() {
        let power = this.orcs.reduce((sum, orc) => sum + orc.power, 0);
        
        const earringGroups = this.groupItems('earrings');
        power += this.calculateBonusForGroups(earringGroups, constants.BONUS_VALUES.EAR_RINGS);
        
        const logoGroups = this.groupItems('logo');
        power += this.calculateBonusForGroups(logoGroups, constants.BONUS_VALUES.LOGO);
        
        const braceletGroups = this.groupItems('bracelet');
        power += this.calculateBonusForGroups(braceletGroups, constants.BONUS_VALUES.BRACELET);
        
        // БОНУС ЗА ПОЛНУЮ КОМАНДУ (7 разных типов)
        if (this.isFullTeam()) {
            power += constants.BONUS_FULL_TEAM ;
        }
        
        return power;
    }

    // Проверка на полную команду (все 7 типов)
    isFullTeam() {
        if (!this.orcs || this.orcs.length !== 7) return false;
        
        const types = new Set(this.orcs.map(orc => orc.type));
        return types.size === 7;
    }

    groupItems(itemType) {
        const groups = {};
        
        this.orcs.forEach(orc => {
            if (itemType === 'logo') {
                // ДЛЯ ЛОГОТИПОВ - ПЕРЕБИРАЕМ МАССИВ
                if (orc.logos && Array.isArray(orc.logos)) {
                    orc.logos.forEach(logoValue => {
                        if (logoValue && logoValue !== '') {
                            // Применяем правила эквивалентности для группировки
                            let groupKey = logoValue;
                            const equivalents = constants.LOGO_EQUIVALENTS_FOR_GROUPING || {};
                            
                            // Если значение есть в эквивалентах, используем целевое значение как ключ группы
                            if (equivalents[logoValue]) {
                                groupKey = equivalents[logoValue];
                            }
                            
                            if (!groups[groupKey]) {
                                groups[groupKey] = {
                                    value: groupKey, // Для группы используем нормализованное значение
                                    count: 0,
                                    orcs: [],
                                    originalValues: new Set() // Сохраняем оригинальные значения
                                };
                            }
                            
                            groups[groupKey].count++;
                            groups[groupKey].orcs.push(orc);
                            groups[groupKey].originalValues.add(logoValue); // Сохраняем оригинал
                        }
                    });
                }
            } else {
                // ДЛЯ СЕРЕГ И БРАСЛЕТОВ - КАК БЫЛО (строка)
                const value = orc[itemType === 'earrings' ? 'earrings' : 'bracelet'];
                if (value && value !== '') {
                    const key = value;
                    if (!groups[key]) {
                        groups[key] = {
                            value: key,
                            count: 0,
                            orcs: [],
                            originalValues: new Set()
                        };
                    }
                    groups[key].count++;
                    groups[key].orcs.push(orc);
                    groups[key].originalValues.add(value);
                }
            }
        });
        
        return groups;
    }

    calculateBonusForGroups(groups, bonusTable) {
        let totalBonus = 0;
        Object.values(groups).forEach(group => {
            if (bonusTable[group.count]) {
                totalBonus += bonusTable[group.count];
            }
        });
        return totalBonus;
    }

    getStats() {
        const stats = {
            basePower: this.orcs.reduce((sum, orc) => sum + orc.power, 0),
            bonuses: {
                earrings: 0,
                logo: 0,
                bracelet: 0,
                fullTeam: 0
            },
            groups: {
                earrings: this.groupItems('earrings'),
                logo: this.groupItems('logo'),
                bracelet: this.groupItems('bracelet')
            },
            bonusDetails: {
                earrings: [],
                logo: [],
                bracelet: [],
                fullTeam: []
            },
            isFullTeam: this.isFullTeam()
        };

        stats.bonuses.earrings = this.calculateBonusForGroupsWithDetails(
            stats.groups.earrings, 
            constants.BONUS_VALUES.EAR_RINGS,
            stats.bonusDetails.earrings
        );
        
        stats.bonuses.logo = this.calculateBonusForGroupsWithDetails(
            stats.groups.logo, 
            constants.BONUS_VALUES.LOGO,
            stats.bonusDetails.logo
        );
        
        stats.bonuses.bracelet = this.calculateBonusForGroupsWithDetails(
            stats.groups.bracelet, 
            constants.BONUS_VALUES.BRACELET,
            stats.bonusDetails.bracelet
        );

        // БОНУС ЗА ПОЛНУЮ КОМАНДУ
        if (stats.isFullTeam) {
            stats.bonuses.fullTeam = constants.BONUS_FULL_TEAM ;
            stats.bonusDetails.fullTeam.push({
                value: 'Полная команда',
                count: 7,
                bonus: stats.bonuses.fullTeam,
                threshold: 7,
                orcs: this.orcs.map(orc => ({
                    id: orc.id,
                    type: orc.type,
                    typeName: orc.typeName
                }))
            });
        }

        return stats;
    }

    calculateBonusForGroupsWithDetails(groups, bonusTable, detailsArray) {
        let totalBonus = 0;
        Object.values(groups).forEach(group => {
            if (bonusTable[group.count]) {
                const bonus = bonusTable[group.count];
                totalBonus += bonus;
                detailsArray.push({
                    value: group.value,       // НОРМАЛИЗОВАННОЕ ЗНАЧЕНИЕ ДЛЯ ГРУППЫ
                    originalValues: Array.from(group.originalValues), // ВСЕ ОРИГИНАЛЬНЫЕ ЗНАЧЕНИЯ
                    count: group.count,
                    bonus: bonus,
                    threshold: group.count,
                    orcs: group.orcs.map(orc => ({
                        id: orc.id,
                        type: orc.type,
                        typeName: orc.typeName
                    }))
                });
            }
        });
        return totalBonus;
    }

    getBonusText() {
        const stats = this.getStats();
        const text = {
            earrings: '0',
            logo: '0',
            bracelet: '0',
            fullTeam: '0'
        };
        
        if (stats.bonusDetails.earrings.length > 0) {
            const parts = stats.bonusDetails.earrings.map(detail => 
                `${detail.value} (${detail.count} шт.)`
            );
            text.earrings = `${stats.bonuses.earrings} (${parts.join(', ')})`;
        } else if (stats.bonuses.earrings > 0) {
            text.earrings = `${stats.bonuses.earrings}`;
        }
        
        if (stats.bonusDetails.logo.length > 0) {
            const parts = stats.bonusDetails.logo.map(detail => {
                // Показываем оригинальные значения, если их несколько
                const originalValues = Array.from(detail.originalValues).join(', ');
                return `${detail.value} (${detail.count} шт.) [${originalValues}]`;
            });
            text.logo = `${stats.bonuses.logo} (${parts.join(', ')})`;
        } else if (stats.bonuses.logo > 0) {
            text.logo = `${stats.bonuses.logo}`;
        }
        
        if (stats.bonusDetails.bracelet.length > 0) {
            const parts = stats.bonusDetails.bracelet.map(detail => 
                `${detail.value} (${detail.count} шт.)`
            );
            text.bracelet = `${stats.bonuses.bracelet} (${parts.join(', ')})`;
        } else if (stats.bonuses.bracelet > 0) {
            text.bracelet = `${stats.bonuses.bracelet}`;
        }

        // БОНУС ЗА ПОЛНУЮ КОМАНДУ
        if (stats.bonuses.fullTeam > 0) {
            text.fullTeam = `${stats.bonuses.fullTeam}`;
        }
        
        return text;
    }

    getBonusDetails() {
        const stats = this.getStats();
        return stats.bonusDetails;
    }
}

function findBestTeam(cards) {
    if (!cards || cards.length === 0) return null;
    
    const byType = {};
    for (let i = 1; i <= 7; i++) {
        byType[i] = cards.filter(c => c.type === i);
    }

    const hasAllTypes = Object.values(byType).every(typeCards => typeCards.length > 0);
    
    if (!hasAllTypes) {
        return null;
    }

    let bestTeam = null;
    let bestPower = -Infinity;

    function backtrack(current, type) {
        if (type > 7) {
            const team = new Team([...current]);
            if (team.totalPower > bestPower) {
                bestPower = team.totalPower;
                bestTeam = team.orcs;
            }
            return;
        }

        for (const orc of byType[type]) {
            current.push(orc);
            backtrack(current, type + 1);
            current.pop();
        }
    }

    backtrack([], 1);
    return bestTeam ? new Team(bestTeam) : null;
}

function comparePlayersStates(before, after) {
    const comparison = [];
    
    before.forEach((origPlayer, index) => {
        const optPlayer = after.find(p => p.id === origPlayer.id);
        if (!optPlayer) return;
        
        const origTeam = origPlayer.team ? origPlayer.team.orcs.map(o => o.id) : [];
        const optTeam = optPlayer.team ? optPlayer.team.orcs.map(o => o.id) : [];
        
        comparison.push({
            playerId: origPlayer.id,
            playerName: origPlayer.name,
            beforePower: origPlayer.teamPower || 0,
            afterPower: optPlayer.teamPower || 0,
            powerChange: (optPlayer.teamPower || 0) - (origPlayer.teamPower || 0),
            addedOrcs: optTeam.filter(id => !origTeam.includes(id)),
            removedOrcs: origTeam.filter(id => !optTeam.includes(id)),
            commonOrcs: origTeam.filter(id => optTeam.includes(id))
        });
    });
    
    return comparison;
}

module.exports = {
    Orc,
    Team,    
    findBestTeam,
    comparePlayersStates
};