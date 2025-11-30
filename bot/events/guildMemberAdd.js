const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Защита от двойной отправки - используем Map для отслеживания промисов отправки
if (!global.welcomeMessagePromises) {
  global.welcomeMessagePromises = new Map();
}

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member, client) {
    const guildId = member.guild.id;
    const userId = member.user.id;
    const key = `${guildId}-${userId}`;
    
    // Если уже обрабатывается, пропускаем
    if (global.welcomeMessagePromises.has(key)) {
      console.log(`⚠️ Пользователь ${member.user.tag} уже обрабатывается, пропускаем дубликат`);
      return;
    }
    
    // Создаем промис и СРАЗУ добавляем в Map (синхронно) для предотвращения race condition
    let resolvePromise;
    const sendPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    
    // Добавляем в Map СИНХРОННО перед любыми асинхронными операциями
    global.welcomeMessagePromises.set(key, sendPromise);
    
    // Удаляем через 10 секунд
    setTimeout(() => {
      global.welcomeMessagePromises.delete(key);
    }, 10000);
    
    // Асинхронная обработка
    (async () => {
      try {
        console.log(`🔄 Обработка пользователя ${member.user.tag} (${key})`);
      const settings = client.db.getGuildSettings(guildId);
      
      console.log(`👤 Новый участник присоединился к серверу ${guildId}: ${member.user.tag}`);
      console.log('📋 Настройки сервера:', JSON.stringify(settings, null, 2));
      
      if (!settings) {
        console.log('⚠️ Настройки для сервера не найдены');
        return;
      }
      
      // Обработка приветственного сообщения
      const welcomeEnabled = settings.welcome_enabled === 1 || settings.welcome_enabled === true || settings.welcome_enabled === '1' || Number(settings.welcome_enabled) === 1;
      console.log(`✅ Приветствие включено: ${welcomeEnabled} (значение: ${settings.welcome_enabled}), Канал: ${settings.welcome_channel_id}`);
      
      if (!welcomeEnabled) {
        console.log(`⚠️ Приветствие отключено (welcome_enabled = ${settings.welcome_enabled})`);
      } else if (!settings.welcome_channel_id) {
        console.log(`⚠️ Канал приветствия не указан (welcome_channel_id = ${settings.welcome_channel_id || 'пусто'})`);
      }
      
      if (welcomeEnabled && settings.welcome_channel_id) {
        const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
        
        if (!channel) {
          console.error(`❌ Канал ${settings.welcome_channel_id} не найден`);
          return;
        }
        
        if (!channel.isTextBased()) {
          console.error(`❌ Канал ${settings.welcome_channel_id} не является текстовым`);
          return;
        }
        
        console.log(`📤 Отправка приветственного сообщения в канал ${channel.name}`);
        
        let welcomeMessage = settings.welcome_message || 'Добро пожаловать, {mention}!';
        
        // Заменяем переменные - используем mention для пинга пользователя
        const mention = `<@${member.user.id}>`;
        welcomeMessage = welcomeMessage
          .replace(/{mention}/g, mention)
          .replace(/{user}/g, mention)
          .replace(/{username}/g, member.user.username)
          .replace(/{guild}/g, member.guild.name)
          .replace(/{memberCount}/g, member.guild.memberCount);
        
        // Если включено изображение приветствия
        const imageEnabled = settings.welcome_image_enabled === 1 || settings.welcome_image_enabled === true || settings.welcome_image_enabled === '1';
        console.log(`🖼️ Изображение включено: ${imageEnabled}`);
        
        if (imageEnabled) {
          const sendType = settings.welcome_image_send_type || 'channel';
          
          try {
            // Получаем URL изображения приветствия
            const welcomeImageUrl = await generateWelcomeImage(member, settings);
            
            if (welcomeImageUrl) {
              // Получаем круглый аватар пользователя (Discord автоматически делает thumbnail круглым)
              const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, dynamic: true });
              
              console.log(`👤 URL аватара пользователя: ${avatarUrl}`);
              
              // Создаем embed с изображением и аватаром пользователя в thumbnail (Discord делает его круглым)
              const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setImage(welcomeImageUrl)
                .setThumbnail(avatarUrl); // Thumbnail автоматически круглый в Discord
              
              // Отправляем в зависимости от типа - ТОЛЬКО ОДИН РАЗ
              if (sendType === 'channel') {
                // Отправляем только изображение
                await channel.send({ embeds: [embed] });
                console.log('✅ Изображение отправлено (channel)');
              } else if (sendType === 'with') {
                // Отправляем изображение вместе с текстовым сообщением
                await channel.send({ content: welcomeMessage, embeds: [embed] });
                console.log('✅ Изображение и текст отправлены вместе (with)');
              } else if (sendType === 'before') {
                // Отправляем изображение перед текстовым сообщением
                await channel.send({ embeds: [embed] });
                await channel.send({ content: welcomeMessage });
                console.log('✅ Изображение и текст отправлены отдельно (before)');
              } else {
                console.log('⚠️ Неизвестный тип отправки, отправляем только текст');
                await channel.send({ content: welcomeMessage });
              }
              
            } else {
              // Если нет изображения, отправляем только текстовое сообщение
              console.log('⚠️ URL изображения не найден, отправляем только текст');
              await channel.send({ content: welcomeMessage });
              console.log('✅ Текстовое сообщение отправлено');
              
            }
          } catch (error) {
            console.error('❌ Ошибка отправки приветствия:', error);
            // Если произошла ошибка, отправляем только текст
            try {
              await channel.send({ content: welcomeMessage });
            } catch (sendError) {
              console.error('❌ Ошибка отправки текстового сообщения:', sendError);
            }
          }
        } else {
          // Отправляем только текстовое сообщение (изображение отключено)
          console.log('📝 Изображение отключено, отправляем только текст');
          await channel.send({ content: welcomeMessage });
          console.log('✅ Текстовое сообщение отправлено');
          
        }
      }
      
      // Выдача авто-роли
      if (settings.auto_role_id) {
        const role = await member.guild.roles.fetch(settings.auto_role_id).catch(() => null);
        if (role) {
          await member.roles.add(role).catch(err => {
            console.error(`❌ Ошибка выдачи авто-роли на сервере ${guildId}:`, err.message);
          });
        }
      }
      } catch (error) {
        console.error('❌ Ошибка обработки присоединения пользователя:', error);
      } finally {
        // Разрешаем промис после завершения обработки
        if (resolvePromise) {
          resolvePromise();
        }
      }
    })();
    
    // Ждем выполнения промиса
    await sendPromise;
  },
};

// Функция получения URL изображения приветствия
async function generateWelcomeImage(member, settings) {
  try {
    const backgroundType = settings.welcome_image_background_type || 'image';
    let backgroundUrl = settings.welcome_image_background || '';
    
    if (!backgroundUrl) {
      return null;
    }
    
    // Если это локальный файл (загружен через /uploads/), преобразуем в полный URL
    if (backgroundUrl.startsWith('/uploads/')) {
      // Получаем базовый URL веб-сервера
      const baseUrl = process.env.WEB_SERVER_URL || process.env.PORT ? `http://localhost:${process.env.PORT || 3000}` : 'http://localhost:3000';
      backgroundUrl = baseUrl + backgroundUrl;
      console.log('🔗 Преобразованный URL изображения:', backgroundUrl);
    }
    
    if (backgroundType === 'image' && backgroundUrl) {
      return backgroundUrl;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Ошибка получения изображения:', error);
    return null;
  }
}

