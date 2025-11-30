const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Защита от двойной отправки - используем Set (более надежно)
const processingMembers = new Set();

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member, client) {
    const guildId = member.guild.id;
    const userId = member.user.id;
    const key = `${guildId}-${userId}`;
    
    // Проверяем, обрабатывается ли уже этот пользователь
    if (processingMembers.has(key)) {
      console.log(`⚠️ Пользователь ${member.user.tag} (${userId}) уже обрабатывается, пропускаем`);
      return;
    }
    
    // Отмечаем, что начинаем обработку
    processingMembers.add(key);
    console.log(`🔄 Начинаем обработку пользователя ${member.user.tag} (${key})`);
    
    // Удаляем через 15 секунд (более длительный период)
    setTimeout(() => {
      processingMembers.delete(key);
      console.log(`✅ Завершена обработка пользователя ${member.user.tag} (${key})`);
    }, 15000);
    
    try {
      
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
          
          try {
            // Получаем URL изображения приветствия
            const welcomeImageUrl = await generateWelcomeImage(member, settings);
            
            if (welcomeImageUrl) {
              // Создаем embed с изображением и аватаром пользователя в thumbnail
              const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setImage(welcomeImageUrl)
                .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
              
              // Отправляем в зависимости от типа - ТОЛЬКО ОДИН РАЗ
              let sent = false;
              
              if (sendType === 'channel') {
                // Отправляем только изображение
                await channel.send({ embeds: [embed] });
                sent = true;
              } else if (sendType === 'with') {
                // Отправляем изображение вместе с текстовым сообщением
                await channel.send({ content: welcomeMessage, embeds: [embed] });
                sent = true;
              } else if (sendType === 'before') {
                // Отправляем изображение перед текстовым сообщением
                await channel.send({ embeds: [embed] });
                await channel.send({ content: welcomeMessage });
                sent = true;
              }
              
              if (!sent) {
                await channel.send({ content: welcomeMessage });
              }
            } else {
              // Если нет изображения, отправляем только текстовое сообщение
              await channel.send({ content: welcomeMessage });
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

