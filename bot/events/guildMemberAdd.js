const { Events, EmbedBuilder } = require('discord.js');

// Простая защита от двойной отправки - используем Set с уникальным ключом
const sentWelcomeKeys = new Set();

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member, client) {
    const guildId = member.guild.id;
    const userId = member.user.id;
    const key = `${guildId}-${userId}`;
    
    // СИНХРОННАЯ проверка - если уже отправлено, пропускаем
    if (sentWelcomeKeys.has(key)) {
      console.log(`⚠️ Сообщение для ${member.user.tag} уже отправлено, пропускаем`);
      return;
    }
    
    // СРАЗУ отмечаем как отправленное (до любых операций)
    sentWelcomeKeys.add(key);
    
    // Удаляем через 5 секунд
    setTimeout(() => {
      sentWelcomeKeys.delete(key);
    }, 5000);
    
    try {
      const settings = client.db.getGuildSettings(guildId);
      
      if (!settings) {
        sentWelcomeKeys.delete(key);
        return;
      }
      
      const welcomeEnabled = settings.welcome_enabled === 1 || settings.welcome_enabled === true || settings.welcome_enabled === '1' || Number(settings.welcome_enabled) === 1;
      
      if (!welcomeEnabled || !settings.welcome_channel_id) {
        sentWelcomeKeys.delete(key);
        return;
      }
      
      const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
      
      if (!channel || !channel.isTextBased()) {
        sentWelcomeKeys.delete(key);
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
          const baseUrl = process.env.WEB_SERVER_URL || (process.env.PORT ? `http://localhost:${process.env.PORT || 3000}` : 'http://localhost:3000');
          welcomeImageUrl = baseUrl + welcomeImageUrl;
        }
        
        if (welcomeImageUrl) {
          const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, dynamic: true });
          
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setImage(welcomeImageUrl)
            .setThumbnail(avatarUrl);
          
          if (sendType === 'channel') {
            await channel.send({ embeds: [embed] });
          } else if (sendType === 'with') {
            await channel.send({ content: welcomeMessage, embeds: [embed] });
          } else if (sendType === 'before') {
            await channel.send({ embeds: [embed] });
            await channel.send({ content: welcomeMessage });
          }
        } else {
          await channel.send({ content: welcomeMessage });
        }
      } else {
        await channel.send({ content: welcomeMessage });
      }
      
      // Выдача авто-роли
      if (settings.auto_role_id) {
        const role = await member.guild.roles.fetch(settings.auto_role_id).catch(() => null);
        if (role) {
          await member.roles.add(role).catch(() => {});
        }
      }
    } catch (error) {
      console.error('❌ Ошибка обработки:', error);
      sentWelcomeKeys.delete(key);
    }
  },
};
