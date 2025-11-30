const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member, client) {
    try {
      const guildId = member.guild.id;
      const settings = client.db.getGuildSettings(guildId);
      
      console.log(`👤 Новый участник присоединился к серверу ${guildId}: ${member.user.tag}`);
      console.log('📋 Настройки сервера:', JSON.stringify(settings, null, 2));
      
      if (!settings) {
        console.log('⚠️ Настройки для сервера не найдены');
        return;
      }
      
      // Обработка приветственного сообщения
      const welcomeEnabled = settings.welcome_enabled === 1 || settings.welcome_enabled === true || settings.welcome_enabled === '1';
      console.log(`✅ Приветствие включено: ${welcomeEnabled}, Канал: ${settings.welcome_channel_id}`);
      
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
        
        let welcomeMessage = settings.welcome_message || 'Добро пожаловать, {user}!';
        
        // Заменяем переменные
        welcomeMessage = welcomeMessage
          .replace(/{user}/g, member.user.username)
          .replace(/{username}/g, member.user.username)
          .replace(/{guild}/g, member.guild.name)
          .replace(/{memberCount}/g, member.guild.memberCount)
          .replace(/{mention}/g, `<@${member.user.id}>`);
        
        // Если включено изображение приветствия
        const imageEnabled = settings.welcome_image_enabled === 1 || settings.welcome_image_enabled === true || settings.welcome_image_enabled === '1';
        console.log(`🖼️ Изображение включено: ${imageEnabled}`);
        
        if (imageEnabled) {
          const sendType = settings.welcome_image_send_type || 'channel';
          
          // Создаем embed с изображением
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setImage(settings.welcome_image_background || null);
          
          // Если есть настройки текста
          if (settings.welcome_image_text) {
            let imageText = settings.welcome_image_text
              .replace(/{user}/g, member.user.username)
              .replace(/{username}/g, member.user.username)
              .replace(/{guild}/g, member.guild.name)
              .replace(/{memberCount}/g, member.guild.memberCount);
            embed.setDescription(imageText);
          }
          
          // Отправляем в зависимости от типа
          if (sendType === 'channel') {
            // Отправляем только изображение
            await channel.send({ embeds: [embed] });
          } else if (sendType === 'with') {
            // Отправляем изображение вместе с текстовым сообщением
            await channel.send({ content: welcomeMessage, embeds: [embed] });
          } else if (sendType === 'before') {
            // Отправляем изображение перед текстовым сообщением
            await channel.send({ embeds: [embed] });
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

