const { Events } = require('discord.js');

class ActivityTracker {
  constructor(client) {
    this.client = client;
    this.db = client.db;
    
    // Map для отслеживания времени подключения пользователей к голосовым каналам
    // Формат: guildId_userId -> timestamp
    this.voiceJoinTimes = new Map();
    
    // Интервал для обновления времени в голосовых каналах (каждую минуту)
    this.voiceUpdateInterval = setInterval(() => {
      this.updateVoiceTime();
    }, 60000); // 60 секунд
    
    this.initialize();
  }

  initialize() {
    // Обработчик сообщений
    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      if (!message.guild) return;
      
      const guildId = message.guild.id;
      const userId = message.author.id;
      
      // Проверяем, включена ли система ролей за активность
      const settings = this.db.getGuildSettings(guildId) || {};
      if (!settings.activity_roles_enabled) return;
      
      // Добавляем сообщение
      const messageCount = this.db.addUserMessage(guildId, userId);
      
      // Проверяем роли после добавления сообщения
      await this.checkAndAssignRoles(guildId, userId);
    });

    // Обработчик подключения к голосовому каналу
    this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      if (!newState.guild) return;
      if (newState.member.user.bot) return;
      
      const guildId = newState.guild.id;
      const userId = newState.member.id;
      
      // Проверяем, включена ли система ролей за активность
      const settings = this.db.getGuildSettings(guildId) || {};
      if (!settings.activity_roles_enabled) return;
      
      const key = `${guildId}_${userId}`;
      const wasInChannel = oldState.channelId !== null;
      const isInChannel = newState.channelId !== null;
      const isMuted = newState.mute || newState.selfMute;
      const isDeafened = newState.deaf || newState.selfDeaf;
      
      // Если пользователь был в канале и вышел (или был отключен)
      if (wasInChannel && !isInChannel) {
        const joinTime = this.voiceJoinTimes.get(key);
        if (joinTime) {
          const timeSpent = Math.floor((Date.now() - joinTime) / 1000); // в секундах
          if (timeSpent > 0 && !isMuted && !isDeafened) {
            this.db.addUserVoiceTime(guildId, userId, timeSpent);
            await this.checkAndAssignRoles(guildId, userId);
          }
          this.voiceJoinTimes.delete(key);
        }
      }
      
      // Если пользователь подключился к каналу (и не заглушен)
      if (!wasInChannel && isInChannel && !isMuted && !isDeafened) {
        this.voiceJoinTimes.set(key, Date.now());
      }
      
      // Если пользователь был в канале, но стал заглушенным - сохраняем время и убираем из отслеживания
      if (wasInChannel && isInChannel && !isMuted && (newState.deaf || newState.selfDeaf)) {
        const joinTime = this.voiceJoinTimes.get(key);
        if (joinTime) {
          const timeSpent = Math.floor((Date.now() - joinTime) / 1000);
          if (timeSpent > 0) {
            this.db.addUserVoiceTime(guildId, userId, timeSpent);
          }
          this.voiceJoinTimes.delete(key);
        }
      }
      
      // Если пользователь был в канале, но стал замучен - сохраняем время и убираем из отслеживания
      if (wasInChannel && isInChannel && (newState.mute || newState.selfMute) && !isDeafened) {
        const joinTime = this.voiceJoinTimes.get(key);
        if (joinTime) {
          const timeSpent = Math.floor((Date.now() - joinTime) / 1000);
          if (timeSpent > 0) {
            this.db.addUserVoiceTime(guildId, userId, timeSpent);
          }
          this.voiceJoinTimes.delete(key);
        }
      }
    });
    
    console.log('✅ ActivityTracker инициализирован');
  }

  // Обновление времени в голосовых каналах (вызывается каждую минуту)
  async updateVoiceTime() {
    const now = Date.now();
    
    for (const [key, joinTime] of this.voiceJoinTimes.entries()) {
      const [guildId, userId] = key.split('_');
      
      try {
        const guild = await this.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
          this.voiceJoinTimes.delete(key);
          continue;
        }
        
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member || !member.voice.channel) {
          this.voiceJoinTimes.delete(key);
          continue;
        }
        
        // Проверяем, не замучен ли пользователь
        const isMuted = member.voice.mute || member.voice.selfMute;
        const isDeafened = member.voice.deaf || member.voice.selfDeaf;
        
        if (isMuted || isDeafened) {
          // Если пользователь замучен, сохраняем накопленное время и убираем из отслеживания
          const timeSpent = Math.floor((now - joinTime) / 1000);
          if (timeSpent > 0) {
            this.db.addUserVoiceTime(guildId, userId, timeSpent);
          }
          this.voiceJoinTimes.delete(key);
          continue;
        }
        
        const timeSpent = Math.floor((now - joinTime) / 1000); // в секундах
        
        if (timeSpent >= 60) { // Обновляем только если прошло не менее минуты
          this.db.addUserVoiceTime(guildId, userId, 60); // Добавляем ровно 60 секунд (1 минуту)
          this.voiceJoinTimes.set(key, now); // Обновляем время последнего обновления
          
          // Проверяем роли
          await this.checkAndAssignRoles(guildId, userId);
        }
      } catch (error) {
        console.error(`Ошибка обновления времени в войсе для ${key}:`, error);
        this.voiceJoinTimes.delete(key);
      }
    }
  }

  // Проверка и выдача ролей на основе активности
  async checkAndAssignRoles(guildId, userId) {
    try {
      const settings = this.db.getGuildSettings(guildId) || {};
      if (!settings.activity_roles_enabled || !settings.activity_roles || !Array.isArray(settings.activity_roles)) {
        return;
      }

      const activity = this.db.getUserActivity(guildId, userId);
      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      // Сортируем роли по требованиям (от большего к меньшему)
      const sortedRoles = [...settings.activity_roles].sort((a, b) => {
        const aTotal = (a.messages || 0) + (a.voiceHours || 0) * 100;
        const bTotal = (b.messages || 0) + (b.voiceHours || 0) * 100;
        return bTotal - aTotal;
      });

      // Находим самую высокую роль, которую пользователь заслужил
      let highestRole = null;
      for (const roleConfig of sortedRoles) {
        const meetsMessages = activity.messages >= (roleConfig.messages || 0);
        const meetsVoice = activity.voiceHours >= (roleConfig.voiceHours || 0);
        
        if (meetsMessages && meetsVoice) {
          highestRole = roleConfig;
          break;
        }
      }

      if (!highestRole) return;

      // Убираем все роли из списка активности, которые ниже текущей
      const currentRoleIndex = sortedRoles.findIndex(r => r.roleId === highestRole.roleId);
      
      for (let i = currentRoleIndex + 1; i < sortedRoles.length; i++) {
        const roleToRemove = await guild.roles.fetch(sortedRoles[i].roleId).catch(() => null);
        if (roleToRemove && member.roles.cache.has(roleToRemove.id)) {
          try {
            await member.roles.remove(roleToRemove);
            console.log(`🎖️ Удалена роль ${roleToRemove.name} у пользователя ${member.user.tag} на сервере ${guild.name}`);
          } catch (error) {
            console.error(`Ошибка удаления роли ${roleToRemove.name}:`, error);
          }
        }
      }

      // Выдаем самую высокую роль, если у пользователя её ещё нет
      const role = await guild.roles.fetch(highestRole.roleId).catch(() => null);
      if (role && !member.roles.cache.has(role.id)) {
        try {
          await member.roles.add(role);
          console.log(`🎖️ Выдана роль ${role.name} пользователю ${member.user.tag} на сервере ${guild.name} (${activity.messages} сообщений, ${activity.voiceHours}h в войсе)`);
        } catch (error) {
          console.error(`Ошибка выдачи роли ${role.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Ошибка проверки ролей за активность:', error);
    }
  }

  destroy() {
    if (this.voiceUpdateInterval) {
      clearInterval(this.voiceUpdateInterval);
    }
    this.voiceJoinTimes.clear();
  }
}

module.exports = ActivityTracker;

