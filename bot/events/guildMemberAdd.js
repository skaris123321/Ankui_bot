const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

// Пытаемся импортировать canvas, если не установлен - используем fallback
let canvas = null;
let createCanvas = null;
let loadImage = null;

try {
  canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
} catch (error) {
  console.warn('⚠️ Canvas не установлен. Установите: npm install canvas');
  console.warn('⚠️ Генерация изображений приветствия будет недоступна');
}

// Защита от двойной отправки
const sentMessages = new Map();

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member, client) {
    try {
      const guildId = member.guild.id;
      const userId = member.user.id;
      
      // Проверяем, не отправляли ли мы уже сообщение для этого пользователя
      const messageKey = `${guildId}-${userId}`;
      if (sentMessages.has(messageKey)) {
        console.log(`⚠️ Сообщение для ${member.user.tag} уже было отправлено, пропускаем`);
        return;
      }
      
      // Отмечаем, что мы отправляем сообщение
      sentMessages.set(messageKey, Date.now());
      
      // Удаляем запись через 10 секунд (защита от повторного входа)
      setTimeout(() => {
        sentMessages.delete(messageKey);
      }, 10000);
      
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
          
          if (canvas && createCanvas && loadImage) {
            try {
              // Генерируем изображение приветствия
              const welcomeImageBuffer = await generateWelcomeImage(member, settings);
              const attachment = new AttachmentBuilder(welcomeImageBuffer, { name: 'welcome.png' });
              
              // Отправляем в зависимости от типа
              if (sendType === 'channel') {
                // Отправляем только изображение
                await channel.send({ files: [attachment] });
              } else if (sendType === 'with') {
                // Отправляем изображение вместе с текстовым сообщением
                await channel.send({ content: welcomeMessage, files: [attachment] });
              } else if (sendType === 'before') {
                // Отправляем изображение перед текстовым сообщением
                await channel.send({ files: [attachment] });
                await channel.send({ content: welcomeMessage });
              }
            } catch (error) {
              console.error('❌ Ошибка генерации изображения:', error);
              // Если не удалось сгенерировать изображение, отправляем только текст
              await channel.send({ content: welcomeMessage });
            }
          } else {
            // Если canvas не установлен, отправляем только текст
            console.warn('⚠️ Canvas не установлен, отправляем только текстовое сообщение');
            await channel.send({ content: welcomeMessage });
          }
        } else {
          // Отправляем только текстовое сообщение
          await channel.send({ content: welcomeMessage });
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
    }
  },
};

// Функция генерации изображения приветствия
async function generateWelcomeImage(member, settings) {
  if (!createCanvas || !loadImage) {
    throw new Error('Canvas не установлен');
  }
  
  try {
    // Размеры изображения (ширина x высота)
    const width = 1024;
    const height = 450;
    
    // Создаем canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Фон
    const backgroundType = settings.welcome_image_background_type || 'image';
    let backgroundUrl = settings.welcome_image_background || 'https://probot.media/UIODnfcGwa.png';
    
    if (backgroundType === 'image' && backgroundUrl) {
      try {
        const background = await loadImage(backgroundUrl);
        ctx.drawImage(background, 0, 0, width, height);
      } catch (err) {
        console.error('Ошибка загрузки фонового изображения:', err);
        // Если не удалось загрузить, используем цвет
        const bgColor = settings.welcome_image_background_color || '#5865F2';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      // Используем цвет как фон
      const bgColor = settings.welcome_image_background_color || '#5865F2';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }
    
    // Аватар пользователя
    const avatarSize = 180;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 80;
    
    try {
      const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
      const avatar = await loadImage(avatarUrl);
      
      // Рисуем круглый аватар с обводкой
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      
      // Белая обводка
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.fillStyle = '#2C2F33';
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 - 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Аватар
      ctx.drawImage(avatar, avatarX + 5, avatarY + 5, avatarSize - 10, avatarSize - 10);
      ctx.restore();
    } catch (err) {
      console.error('Ошибка загрузки аватара:', err);
    }
    
    // Имя пользователя
    const username = settings.welcome_image_username_text || member.user.username;
    const usernameColor = settings.welcome_image_username_color || '#FFFFFF';
    ctx.fillStyle = usernameColor;
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Тень для текста
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillText(username, width / 2, avatarY + avatarSize + 20);
    
    // Текст приветствия
    let welcomeText = settings.welcome_image_text || 'Добро пожаловать!';
    // Заменяем переменные
    welcomeText = welcomeText
      .replace(/{user}/g, member.user.username)
      .replace(/{username}/g, member.user.username)
      .replace(/{guild}/g, member.guild.name)
      .replace(/{memberCount}/g, member.guild.memberCount);
    
    const textColor = settings.welcome_image_text_color || '#FFFFFF';
    ctx.fillStyle = textColor;
    ctx.font = '32px Arial';
    
    ctx.fillText(welcomeText, width / 2, avatarY + avatarSize + 80);
    
    // Убираем тень
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Возвращаем буфер изображения
    return canvas.toBuffer();
  } catch (error) {
    console.error('❌ Ошибка генерации изображения приветствия:', error);
    throw error;
  }
}

