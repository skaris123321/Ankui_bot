const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Показать статистику пользователей')
    .addStringOption(option =>
      option
        .setName('тип')
        .setDescription('Тип статистики (по умолчанию: сообщения)')
        .setRequired(false)
        .addChoices(
          { name: 'Топ по сообщениям', value: 'messages' },
          { name: 'Топ по онлайну', value: 'voice' }
        )),
  
  async execute(interaction, client) {
    console.log('🔧 Команда /stats вызвана');
    try {
      console.log('⏳ Отложенный ответ на команду /stats...');
      await interaction.deferReply();
      console.log('✅ Ответ отложен');
    } catch (deferError) {
      console.error('❌ Ошибка при отложенном ответе:', deferError);
      return;
    }
    
    try {
      const guildId = interaction.guild.id;
      const channel = interaction.channel;
      const allowedChannelId = '1444744987677032538';
      
      if (channel.id !== allowedChannelId && channel.name !== 'spam-chat' && !channel.name.toLowerCase().includes('spam')) {
        return interaction.editReply({ 
          content: '❌ Эта команда доступна только в канале spam-chat!' 
        });
      }

      const statsType = interaction.options.getString('тип') || 'messages';
      const db = client.db;
      db.load();

      console.log(`📊 Запрос статистики для сервера: ${guildId}`);
      console.log(`📊 Тип статистики: ${statsType}`);
      console.log(`📊 Всего записей в userLevels: ${Object.keys(db.data.userLevels || {}).length}`);
      console.log(`📊 Содержимое userLevels:`, JSON.stringify(db.data.userLevels, null, 2));

      const allUsers = Object.values(db.data.userLevels || {})
        .filter(user => {
          const matches = user.guild_id === guildId;
          if (!matches) {
            console.log(`⏭️ Пропуск пользователя ${user.user_id}: guild_id ${user.guild_id} !== ${guildId}`);
          }
          return matches;
        });

      console.log(`📊 Пользователей после фильтрации: ${allUsers.length}`);

      let sortedUsers = [];
      let title = '';

      if (statsType === 'messages') {
        sortedUsers = allUsers
          .sort((a, b) => (b.messages || 0) - (a.messages || 0))
          .slice(0, 140);
        title = 'Топ пользователей по сообщениям';
      } else if (statsType === 'voice') {
        sortedUsers = allUsers
          .sort((a, b) => (b.voiceTime || 0) - (a.voiceTime || 0))
          .slice(0, 140);
        title = 'Топ пользователей по онлайну';
      }

      if (sortedUsers.length === 0) {
        return interaction.editReply({ 
          content: '❌ Нет данных для отображения статистики.'
        });
      }

      const formatTime = (seconds) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (days > 0) {
          return `${days} дней, ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else {
          return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
      };

      const createEmbed = (page = 0) => {
        const itemsPerPage = 20;
        const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
        const startIndex = page * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, sortedUsers.length);
        const pageUsers = sortedUsers.slice(startIndex, endIndex);

        let description = '';
        for (let i = 0; i < pageUsers.length; i++) {
          const userData = pageUsers[i];
          const rank = startIndex + i + 1;
          
          try {
            const member = interaction.guild.members.cache.get(userData.user_id);
            const username = member ? member.displayName : `<@${userData.user_id}>`;
            
            let value = '';
            if (statsType === 'messages') {
              value = `${userData.messages || 0} 💬`;
            } else {
              const voiceSeconds = userData.voiceTime || 0;
              value = `${formatTime(voiceSeconds)} 🎙️`;
            }
            
            description += `${rank}. ${username} - ${value}\n`;
          } catch (error) {
            description += `${rank}. <@${userData.user_id}> - ${statsType === 'messages' ? (userData.messages || 0) + ' 💬' : formatTime(userData.voiceTime || 0) + ' 🎙️'}\n`;
          }
        }

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(title)
          .setDescription(description)
          .setFooter({ 
            text: `Вызвал: ${interaction.user.displayName} • Страница ${page + 1}/${totalPages}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();

        return { embed, totalPages, currentPage: page };
      };

      const { embed, totalPages } = createEmbed(0);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`stats_back_${statsType}_0_${interaction.user.id}`)
            .setLabel('Назад')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`stats_delete_${statsType}_${interaction.user.id}`)
            .setLabel('Удалить')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`stats_next_${statsType}_0_${interaction.user.id}`)
            .setLabel('Вперед')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(totalPages <= 1)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('❌ Ошибка в команде /stats:', error);
      if (interaction.deferred) {
        await interaction.editReply({ 
          content: '❌ Произошла ошибка при выполнении команды статистики!'
        }).catch(() => {});
      } else if (!interaction.replied) {
        await interaction.reply({ 
          content: '❌ Произошла ошибка при выполнении команды статистики!', 
          flags: MessageFlags.Ephemeral 
        }).catch(() => {});
      }
    }
  },
};
