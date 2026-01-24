const { Events } = require('discord.js');

class ActivityTracker {
  constructor(client, database) {
    this.client = client;
    this.db = database;
    this.voiceStates = new Map(); // Отслеживание времени входа в голосовые каналы

    console.log('🎯 ActivityTracker инициализирован');
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Отслеживание сообщений
    this.client.on(Events.MessageCreate, (message) => {
      this.handleMessage(message);
    });

    // Отслеживание голосовой активности
    this.client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      this.handleVoiceStateUpdate(oldState, newState);
    });

    console.log('✅ ActivityTracker: События настроены');
  }

  handleMessage(message) {
    // Игнорируем ботов и системные сообщения
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    try {
      // Получаем текущую статистику пользователя
      let userStats = this.db.getUserStats(guildId, userId) || {
        messages: 0,
        voiceTime: 0,
        lastActive: null
      };

      // Увеличиваем счетчик сообщений
      userStats.messages = (userStats.messages || 0) + 1;
      userStats.lastActive = Date.now();

      // Сохраняем обновленную статистику
      this.db.setUserStats(guildId, userId, userStats);

      console.log(`📝 Сообщение от ${message.author.username}: ${userStats.messages} сообщений`);
    } catch (error) {
      console.error('❌ Ошибка обработки сообщения:', error);
    }
  }

  handleVoiceStateUpdate(oldState, newState) {
    const userId = newState.member?.id || oldState.member?.id;
    const guildId = newState.guild?.id || oldState.guild?.id;

    if (!userId || !guildId) return;

    // Игнорируем ботов
    const member = newState.member || oldState.member;
    if (member?.user?.bot) return;

    const userKey = `${guildId}_${userId}`;
    const now = Date.now();

    try {
      // Пользователь присоединился к голосовому каналу
      if (!oldState.channelId && newState.channelId) {
        this.voiceStates.set(userKey, now);
        console.log(`🎤 ${member.user.username} присоединился к голосовому каналу`);
      }
      // Пользователь покинул голосовой канал
      else if (oldState.channelId && !newState.channelId) {
        const joinTime = this.voiceStates.get(userKey);
        if (joinTime) {
          const sessionDuration = now - joinTime;
          this.voiceStates.delete(userKey);

          // Получаем текущую статистику пользователя
          let userStats = this.db.getUserStats(guildId, userId) || {
            messages: 0,
            voiceTime: 0,
            lastActive: null
          };

          // Добавляем время сессии к общему времени
          userStats.voiceTime = (userStats.voiceTime || 0) + sessionDuration;
          userStats.lastActive = now;

          // Сохраняем обновленную статистику
          this.db.setUserStats(guildId, userId, userStats);

          const sessionMinutes = Math.floor(sessionDuration / 60000);
          const totalMinutes = Math.floor(userStats.voiceTime / 60000);
          console.log(`🎤 ${member.user.username} покинул голосовой канал. Сессия: ${sessionMinutes}м, всего: ${totalMinutes}м`);
        }
      }
      // Пользователь переключился между каналами (не учитываем как выход/вход)
      else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // Просто обновляем время входа для нового канала
        this.voiceStates.set(userKey, now);
        console.log(`🎤 ${member.user.username} переключился между голосовыми каналами`);
      }
    } catch (error) {
      console.error('❌ Ошибка обработки голосового состояния:', error);
    }
  }

  // Метод для получения текущих пользователей в голосовых каналах при запуске бота
  initializeVoiceStates() {
    console.log('🎯 Инициализация голосовых состояний...');

    this.client.guilds.cache.forEach(guild => {
      guild.voiceStates.cache.forEach(voiceState => {
        if (voiceState.channelId && voiceState.member && !voiceState.member.user.bot) {
          const userKey = `${guild.id}_${voiceState.member.id}`;
          this.voiceStates.set(userKey, Date.now());
          console.log(`🎤 Найден пользователь в голосовом канале: ${voiceState.member.user.username}`);
        }
      });
    });

    console.log(`✅ Инициализировано ${this.voiceStates.size} голосовых состояний`);
  }

  // Метод для сохранения всех активных голосовых сессий (при выключении бота)
  saveActiveVoiceSessions() {
    console.log('💾 Сохранение активных голосовых сессий...');

    const now = Date.now();
    let savedSessions = 0;

    this.voiceStates.forEach((joinTime, userKey) => {
      const [guildId, userId] = userKey.split('_');
      const sessionDuration = now - joinTime;

      try {
        // Получаем текущую статистику пользователя
        let userStats = this.db.getUserStats(guildId, userId) || {
          messages: 0,
          voiceTime: 0,
          lastActive: null
        };

        // Добавляем время сессии к общему времени
        userStats.voiceTime = (userStats.voiceTime || 0) + sessionDuration;
        userStats.lastActive = now;

        // Сохраняем обновленную статистику
        this.db.setUserStats(guildId, userId, userStats);
        savedSessions++;

        const sessionMinutes = Math.floor(sessionDuration / 60000);
        console.log(`💾 Сохранена сессия пользователя ${userId}: ${sessionMinutes}м`);
      } catch (error) {
        console.error(`❌ Ошибка сохранения сессии для ${userId}:`, error);
      }
    });

    this.voiceStates.clear();
    console.log(`✅ Сохранено ${savedSessions} активных голосовых сессий`);
  }
}

module.exports = ActivityTracker;