const { Events, EmbedBuilder } = require('discord.js');

// Глобальная защита от двойной отправки - используем глобальный Set с уникальным ключом
// Это гарантирует, что защита работает даже если модуль загружается несколько раз
if (!global.welcomeMessageSent) {
  global.welcomeMessageSent = new Set();
}

// Map для отслеживания времени последней обработки (дополнительная защита)
if (!global.welcomeMessageTimestamps) {
  global.welcomeMessageTimestamps = new Map();
}

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member, client) {
    const guildId = member.guild.id;
    const userId = member.user.id;
    const key = `${guildId}-${userId}`;
    const now = Date.now();
    
    // Двойная проверка: проверяем и Set, и время последней обработки
    if (global.welcomeMessageSent.has(key)) {
      console.log(`⚠️ [${key}] Сообщение для ${member.user.tag} уже отправлено, пропускаем (Set)`);
      return;
    }
    
    // Проверяем, не обрабатывался ли этот пользователь недавно (в последние 10 секунд)
    const lastProcessed = global.welcomeMessageTimestamps.get(key);
    if (lastProcessed && (now - lastProcessed) < 10000) {
      console.log(`⚠️ [${key}] Пользователь ${member.user.tag} обрабатывался недавно (${Math.round((now - lastProcessed) / 1000)} сек назад), пропускаем`);
      return;
    }
    
    // СРАЗУ отмечаем как отправленное (до любых операций) - СИНХРОННО
    global.welcomeMessageSent.add(key);
    global.welcomeMessageTimestamps.set(key, now);
    
    console.log(`🔄 [${key}] Начало обработки приветствия для ${member.user.tag}`);
    
    // Удаляем из Set через 30 секунд
    setTimeout(() => {
      global.welcomeMessageSent.delete(key);
      console.log(`🗑️ [${key}] Ключ удален из Set (через 30 сек)`);
    }, 30000);
    
    // Удаляем timestamp через 60 секунд
    setTimeout(() => {
      global.welcomeMessageTimestamps.delete(key);
    }, 60000);
    
    try {
      const settings = client.db.getGuildSettings(guildId);
      
      if (!settings) {
        global.welcomeMessageSent.delete(key);
        global.welcomeMessageTimestamps.delete(key);
        return;
      }
      
      const welcomeEnabled = settings.welcome_enabled === 1 || settings.welcome_enabled === true || settings.welcome_enabled === '1' || Number(settings.welcome_enabled) === 1;
      
      if (!welcomeEnabled || !settings.welcome_channel_id) {
        global.welcomeMessageSent.delete(key);
        global.welcomeMessageTimestamps.delete(key);
        return;
      }
      
      const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
      
      if (!channel || !channel.isTextBased()) {
        global.welcomeMessageSent.delete(key);
        global.welcomeMessageTimestamps.delete(key);
        return;
      }
      
      let welcomeMessage = settings.welcome_message || 'Добро пожаловать, {mention}!';
      const mention = `<@${member.user.id}>`;
      welcomeMessage = welcomeMessage
        .replace(/{mention}/g, mention)
        .replace(/{user}/g, mention)
        .replace(/{username}/g, member.user.username)
        .replace(/{guild}/g, member.guild.name)
        .replace(/{memberCount}/g, member.guild.memberCount);
      
      const imageEnabled = settings.welcome_image_enabled === 1 || settings.welcome_image_enabled === true || settings.welcome_image_enabled === '1';
      
      if (imageEnabled) {
        const sendType = settings.welcome_image_send_type || 'channel';
        let welcomeImageUrl = settings.welcome_image_background || '';
        
        if (welcomeImageUrl && welcomeImageUrl.startsWith('/uploads/')) {
          // Определяем базовый URL - проверяем переменные окружения Render/Railway/etc
          let baseUrl = process.env.WEB_SERVER_URL || process.env.RENDER_EXTERNAL_URL || process.env.RAILWAY_STATIC_URL;
          
          if (!baseUrl) {
            // Проверяем наличие переменных, указывающих на Render
            // Render устанавливает RENDER=true и RENDER_SERVICE_NAME
            if (process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME) {
              // На Render - пытаемся определить URL из названия сервиса
              const serviceName = process.env.RENDER_SERVICE_NAME || 'ankui-bot';
              baseUrl = `https://${serviceName}.onrender.com`;
            } else if (process.env.RAILWAY_ENVIRONMENT) {
              // На Railway
              baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN || `http://localhost:${process.env.PORT || 3000}`;
            } else {
              // Локальная разработка
              baseUrl = `http://localhost:${process.env.PORT || 3000}`;
            }
          }
          
          // Убираем trailing slash если есть
          baseUrl = baseUrl.replace(/\/$/, '');
          welcomeImageUrl = baseUrl + welcomeImageUrl;
          
          console.log(`🔗 Преобразован URL изображения: ${welcomeImageUrl}`);
          console.log(`🔍 Переменные окружения: RENDER=${process.env.RENDER}, RENDER_SERVICE_NAME=${process.env.RENDER_SERVICE_NAME}, WEB_SERVER_URL=${process.env.WEB_SERVER_URL}`);
        }
        
        if (welcomeImageUrl) {
          const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, dynamic: true });
          
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setImage(welcomeImageUrl)
            .setThumbnail(avatarUrl);
          
          // ФИНАЛЬНАЯ проверка перед отправкой - убеждаемся, что не отправили уже
          if (global.welcomeMessageSent.has(key)) {
            if (sendType === 'channel') {
              await channel.send({ embeds: [embed] });
              console.log(`✅ [${key}] Изображение отправлено`);
            } else if (sendType === 'with') {
              await channel.send({ content: welcomeMessage, embeds: [embed] });
              console.log(`✅ [${key}] Изображение и текст отправлены вместе`);
            } else if (sendType === 'before') {
              await channel.send({ embeds: [embed] });
              await channel.send({ content: welcomeMessage });
              console.log(`✅ [${key}] Изображение и текст отправлены отдельно`);
            }
          } else {
            console.log(`⚠️ [${key}] Ключ был удален до отправки, пропускаем`);
          }
        } else {
          // ФИНАЛЬНАЯ проверка перед отправкой
          if (global.welcomeMessageSent.has(key)) {
            await channel.send({ content: welcomeMessage });
            console.log(`✅ [${key}] Текстовое сообщение отправлено (без изображения)`);
          }
        }
      } else {
        // ФИНАЛЬНАЯ проверка перед отправкой
        if (global.welcomeMessageSent.has(key)) {
          await channel.send({ content: welcomeMessage });
          console.log(`✅ [${key}] Текстовое сообщение отправлено`);
        }
      }
      
      // Выдача авто-роли
      if (settings.auto_role_id) {
        const role = await member.guild.roles.fetch(settings.auto_role_id).catch(() => null);
        if (role) {
          await member.roles.add(role).catch(() => {});
        }
      }
    } catch (error) {
      console.error(`❌ [${key}] Ошибка обработки приветствия:`, error);
      // Не удаляем из Set при ошибке - пусть остается защита от повторной попытки
    }
  },
};
