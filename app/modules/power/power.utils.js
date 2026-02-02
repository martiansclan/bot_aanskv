// Утилиты для модуля Power (синхронизировано с synergyCalculator.js)
const CONSTANTS = require('./power.constants');

class PowerUtils {
    // Расчет синергий атрибутов
    calculateAttributeSynergy(nft, synergyData) {
        if (!nft[CONSTANTS.NFT_KEYS.ATTRIBUTES] || !Array.isArray(nft[CONSTANTS.NFT_KEYS.ATTRIBUTES])) {
            return { 
                synergyPower: 0, 
                synergies: [] 
            };
        }
        
        // Исключаем атрибуты из расчета синергий
        const attributesForSynergy = nft[CONSTANTS.NFT_KEYS.ATTRIBUTES].filter(attr => 
            !CONSTANTS.EXCLUDED_ATTRIBUTES.includes(attr.trait_type) && 
            attr.trait_type !== 'Skin tone' // дополнительная проверка
        );
        
        if (attributesForSynergy.length < 2) {
            return { 
                synergyPower: 0, 
                synergies: [] 
            };
        }
        
        const synergyResults = [];
        const usedAttributes = new Set();
        
        // Проверяем каждую синергию
        for (const [synergyName, synergyValues] of Object.entries(synergyData)) {
            // Находим атрибуты NFT, которые входят в эту синергию
            const matchingAttributes = attributesForSynergy.filter(attr => 
                synergyValues.includes(attr.value)
            );
            
            if (matchingAttributes.length >= 2) {
                // Создаем запись о синергии
                const synergyEntry = {
                    synergy_type: synergyName,
                    rarity: matchingAttributes.length.toString(),
                    attributes: matchingAttributes.map(attr => 
                        `${attr[CONSTANTS.NFT_KEYS.TRAIT_TYPE]}: ${attr[CONSTANTS.NFT_KEYS.VALUE]}`
                    ).join(', '),
                    power: 0
                };
                
                // Определяем бонус power в зависимости от количества совпадений
                if (matchingAttributes.length === 2) {
                    synergyEntry.power = CONSTANTS.SYNERGY_POWER_VALUES.TWO_ATTRIBUTES;
                } else if (matchingAttributes.length === 3) {
                    synergyEntry.power = CONSTANTS.SYNERGY_POWER_VALUES.THREE_ATTRIBUTES;
                }
                
                synergyResults.push(synergyEntry);
                
                // Помечаем атрибуты как использованные в синергии
                matchingAttributes.forEach(attr => {
                    usedAttributes.add(`${attr[CONSTANTS.NFT_KEYS.TRAIT_TYPE]}:${attr[CONSTANTS.NFT_KEYS.VALUE]}`);
                });
            }
        }
        
        // Считаем общий бонус синергий (не суммируем повторы)
        let totalSynergyPower = 0;
        const countedSynergies = new Set();
        
        // Сортируем синергии по power (от большего к меньшему)
        synergyResults.sort((a, b) => b.power - a.power);
        
        const finalSynergies = [];
        
        for (const synergy of synergyResults) {
            // Проверяем, не пересекаются ли атрибуты с уже учтенными синергиями
            const synergyAttributes = synergy.attributes.split(', ');
            let hasOverlap = false;
            
            for (const countedAttr of countedSynergies) {
                if (synergyAttributes.some(attr => countedAttr.includes(attr.split(':')[0]))) {
                    // Если атрибут уже использован в более высокой синергии, пропускаем
                    hasOverlap = true;
                    break;
                }
            }
            
            if (!hasOverlap) {
                totalSynergyPower += synergy.power;
                finalSynergies.push(synergy);
                
                // Добавляем атрибуты этой синергии в учет
                synergyAttributes.forEach(attr => {
                    countedSynergies.add(attr);
                });
            }
        }
        
        return {
            synergyPower: totalSynergyPower,
            synergies: finalSynergies
        };
    }
    
    // Расчет Power для NFT с учетом синергий
    calculateNFTpower(nft, powerData, synergyData = null) {
        const { attributes_power } = powerData;
        const { rarity_power, attributes: attributesMap } = attributes_power;
        
        let totalPower = 0;
        let attributesUpdated = false;
        let synergyPower = 0;
        let attributeSynergy = [];
        
        if (!nft[CONSTANTS.NFT_KEYS.ATTRIBUTES] || !Array.isArray(nft[CONSTANTS.NFT_KEYS.ATTRIBUTES])) {
            return { 
                nft, 
                updated: false, 
                totalPower: 0,
                synergyPower: 0,
                attributeSynergy: []
            };
        }
        
        // 1. Расчет power на основе редкости атрибутов
        nft[CONSTANTS.NFT_KEYS.ATTRIBUTES].forEach(attr => {
            const traitType = attr[CONSTANTS.NFT_KEYS.TRAIT_TYPE];
            const value = attr[CONSTANTS.NFT_KEYS.VALUE];
            
            if (attributesMap[traitType]) {
                const traitValues = attributesMap[traitType];
                
                if (traitValues[value]) {
                    const rarity = traitValues[value];
                    
                    if (rarity_power[rarity]) {
                        const power = rarity_power[rarity];
                        
                        attr[CONSTANTS.NFT_KEYS.RARITY] = rarity;
                        attr[CONSTANTS.NFT_KEYS.POWER] = power;
                        
                        totalPower += power;
                        attributesUpdated = true;
                    }
                }
            }
        });
        
        // 2. Расчет синергий (если есть данные о синергиях)
        if (synergyData && Object.keys(synergyData).length > 0) {
            const synergyResult = this.calculateAttributeSynergy(nft, synergyData);
            synergyPower = synergyResult.synergyPower;
            attributeSynergy = synergyResult.synergies;
            
            // Добавляем синергии к NFT
            if (synergyPower > 0) {
                nft[CONSTANTS.NFT_KEYS.ATTRIBUTE_SYNERGY] = attributeSynergy;
            }
        }
        
        // Добавляем общий power к NFT
        if (attributesUpdated) {
            nft[CONSTANTS.NFT_KEYS.POWER_ATTRIBUTES] = totalPower;
            nft[CONSTANTS.NFT_KEYS.POWER_TOTAL] = totalPower + synergyPower;
            nft[CONSTANTS.NFT_KEYS.SYNERGY_POWER] = synergyPower;
        } else {
            nft[CONSTANTS.NFT_KEYS.POWER_TOTAL] = synergyPower;
            nft[CONSTANTS.NFT_KEYS.SYNERGY_POWER] = synergyPower;
        }
        
        return { 
            nft, 
            updated: attributesUpdated, 
            totalPower: totalPower,
            synergyPower: synergyPower,
            attributeSynergy: attributeSynergy
        };
    }
}

module.exports = new PowerUtils();