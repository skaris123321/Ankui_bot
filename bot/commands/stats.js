const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Показать статистику пользователей')
    .addStringOption(option =>
      option.setName('тип')
        .setDescription('Тип статистики')
        .setRequired(true)
        .addChoices(
          { name: 'Топ по сообщениям', value: 'messages' },
          { name: 'Топ по онлайну', value: 'voice' }
        )),
  
  async execute(interaction, client) {
    try {
      const guildId = interaction.guild.id;
      const channel = interaction.channel;
      
      // ID разрешенного канала spam-chat
      const allowedChannelId = '1444744987677032538';
      
      console.log(`📊 Команда /stats вызвана в канале: ${channel.name} (ID: ${channel.id})`);
      
      // Проверяем, что команда используется в разрешенном канале (по ID или имени)
      if (channel.id !== allowedChannelId && channel.name !== 'spam-chat' && !channel.name.includes('spam')) {
        console.log(`❌ Команда /stats отклонена: канал не разрешен`);
        return interaction.reply({ 
          content: '❌ Эта команда доступна только в канале spam-chat!', 
          ephemeral: true 
        });
      }

    const statsType = interaction.options.getString('тип');
    const db = client.db;

    // Загружаем актуальные данные из базы
    db.load();

    // Получаем всех пользователей из базы данных для этого сервера
    // Используем внутреннее свойство data, которое доступно после load()
    const allUsers = Object.values(db.data.userLevels || {})
      .filter(user => user.guild_id === guildId);

    let sortedUsers = [];
    let title = '';
    let fieldName = '';

    if (statsType === 'messages') {
      sortedUsers = allUsers
        .sort((a, b) => (b.messages || 0) - (a.messages || 0))
        .slice(0, 140); // Максимум 140 пользователей (7 страниц по 20)
      title = 'Топ пользователей по сообщениям';
      fieldName = 'сообщений';
    } else if (statsType === 'voice') {
      sortedUsers = allUsers
        .sort((a, b) => (b.voiceTime || 0) - (a.voiceTime || 0))
        .slice(0, 140);
      title = 'Топ пользователей по онлайну';
      fieldName = 'онлайн';
    }

    if (sortedUsers.length === 0) {
      return interaction.reply({ 
        content: '❌ Нет данных для отображения статистики.', 
        ephemeral: true 
      });
    }

    // Функция для форматирования времени
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

    // Функция для создания embed со страницей
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

    // Создаем первую страницу
    const { embed, totalPages } = createEmbed(0);

    // Создаем кнопки навигации
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

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('❌ Ошибка в команде /stats:', error);
      console.error(error.stack);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: '❌ Произошла ошибка при выполнении команды статистики!', 
          ephemeral: true 
        }).catch(() => {});
      }
    }
  },
};

