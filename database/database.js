const fs = require('fs');
const path = require('path');

class BotDatabase {
  constructor() {
    this.dbPath = path.join(__dirname, 'bot-data.json');
    this.data = {
      guilds: {},
      warnings: [],
      modLogs: [],
      userLevels: {},
      userStats: {},
      images: {},
      userDrafts: {}
    };
    this.initialize();
  }

  initialize() {
    this.load();
  }
  
  load() {
    // Загружаем данные из файла, если он существует
    if (fs.existsSync(this.dbPath)) {
      try {
        const rawData = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(rawData);
        console.log('База данных загружена из файла');
      } catch (error) {
        console.error('Ошибка загрузки базы данных, создаем новую:', error);
        this.data = {
          guilds: {},
          warnings: [],
          modLogs: [],
          userLevels: {},
          userStats: {},
          images: {},
          userDrafts: {}
        };
        this.save();
      }
    } else {
      this.data = {
        guilds: {},
        warnings: [],
        modLogs: [],
        userLevels: {},
        userStats: {},
        images: {},
        userDrafts: {}
      };
      this.save();
      console.log('База данных инициализирована');
    }
  }

  save() {
    try {
      const dataString = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(this.dbPath, dataString, 'utf8');
      console.log('База данных сохранена');
    } catch (error) {
      console.error('Ошибка сохранения базы данных:', error);
      throw error;
    }
  }

  // Методы для настроек сервера
  getGuildSettings(guildId) {
    return this.data.guilds[guildId] || null;
  }

  setGuildSettings(guildId, settings) {
    if (!this.data.guilds[guildId]) {
      this.data.guilds[guildId] = {
        guild_id: guildId,
        rules_text: '',
        prefix: '!',
        language: 'ru'
      };
    }
    
    // Полностью перезаписываем настройки, сохраняя все существующие
    this.data.guilds[guildId] = {
      ...this.data.guilds[guildId],
      ...settings
    };
    
    // Сохраняем в файл
    this.save();
    
    console.log(`Настройки для сервера ${guildId} сохранены:`, JSON.stringify(this.data.guilds[guildId], null, 2));
  }

  // Методы для предупреждений
  addWarning(guildId, userId, moderatorId, reason) {
    const warning = {
      id: Date.now(),
      guild_id: guildId,
      user_id: userId,
      moderator_id: moderatorId,
      reason: reason,
      timestamp: Date.now()
    };
    this.data.warnings.push(warning);
    this.save();
    return warning;
  }

  getWarnings(guildId, userId) {
    return this.data.warnings
      .filter(w => w.guild_id === guildId && w.user_id === userId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  removeWarning(warningId) {
    this.data.warnings = this.data.warnings.filter(w => w.id !== warningId);
    this.save();
  }

  clearWarnings(guildId, userId) {
    this.data.warnings = this.data.warnings.filter(w => 
      !(w.guild_id === guildId && w.user_id === userId)
    );
    this.save();
  }

  // Методы для модерационных логов
  addModLog(guildId, actionType, targetId, moderatorId, reason = null) {
    const log = {
      id: Date.now(),
      guild_id: guildId,
      action_type: actionType,
      target_id: targetId,
      moderator_id: moderatorId,
      reason: reason,
      timestamp: Date.now()
    };
    this.data.modLogs.push(log);
    this.save();
    return log;
  }

  getModLogs(guildId, limit = 50) {
    return this.data.modLogs
      .filter(log => log.guild_id === guildId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Методы для системы уровней
  getUserLevel(guildId, userId) {
    const key = `${guildId}_${userId}`;
    return this.data.userLevels[key] || null;
  }

  addUserXP(guildId, userId, xpAmount) {
    const key = `${guildId}_${userId}`;
    const user = this.getUserLevel(guildId, userId);
    
    if (user) {
      const newXP = user.xp + xpAmount;
      const newLevel = Math.floor(Math.sqrt(newXP / 100));
      
      this.data.userLevels[key].xp = newXP;
      this.data.userLevels[key].level = newLevel;
      this.data.userLevels[key].messages += 1;
      this.save();
      
      return { leveledUp: newLevel > user.level, newLevel };
    } else {
      this.data.userLevels[key] = {
        guild_id: guildId,
        user_id: userId,
        xp: xpAmount,
        level: 0,
        messages: 1
      };
      this.save();
      
      return { leveledUp: false, newLevel: 0 };
    }
  }

  getTopUsers(guildId, limit = 10) {
    return Object.values(this.data.userLevels)
      .filter(user => user.guild_id === guildId)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);
  }

  // Методы для статистики пользователей
  getUserStats(guildId, userId) {
    const key = `${guildId}_${userId}`;
    return this.data.userStats ? this.data.userStats[key] : null;
  }

  setUserStats(guildId, userId, stats) {
    const key = `${guildId}_${userId}`;
    if (!this.data.userStats) {
      this.data.userStats = {};
    }

    this.data.userStats[key] = {
      guild_id: guildId,
      user_id: userId,
      messages: stats.messages || 0,
      voiceTime: stats.voiceTime || 0,
      lastActive: stats.lastActive || Date.now()
    };

    this.save();
  }

  getAllUserStats(guildId) {
    if (!this.data.userStats) return [];

    return Object.values(this.data.userStats)
      .filter(stats => stats.guild_id === guildId)
      .sort((a, b) => {
        const scoreA = a.messages + Math.floor(a.voiceTime / 60000);
        const scoreB = b.messages + Math.floor(b.voiceTime / 60000);
        return scoreB - scoreA;
      });
  }

  close() {
    this.save();
  }
}

module.exports = BotDatabase;

