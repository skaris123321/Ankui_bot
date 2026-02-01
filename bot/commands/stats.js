const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Показать статистику активности пользователей на сервере')
    .addStringOption(option =>
      option.setName('тип')
        .setDescription('Тип статистики')
        .setRequired(true)
        .addChoices(
          { name: '💬 По сообщениям', value: 'messages' },
          { name: '🎤 По времени в войсе', value: 'voice' }
        )
    )
    .addIntegerOption(option =>
      option.setName('лимит')
        .setDescription('Количество пользователей для показа (по умолчанию 20)')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(50)
    ),

  async execute(interaction, client) {
    try {
      // Быстро отвечаем, чтобы избежать timeout
      await interaction.deferReply();

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: '❌ Ошибка: команда должна выполняться на сервере.' });
        return;
      }

      const guildId = guild.id;
      const selectedType = interaction.options.getString('тип');
      const limit = interaction.options.getInteger('лимит') || 20;

      console.log(`📊 Команда /stats: тип=${selectedType}, лимит=${limit}, сервер=${guildId}`);

      // Проверяем, что база данных доступна
      if (!client.db) {
        console.error('❌ База данных не инициализирована');
        await interaction.editReply({ content: '❌ Ошибка: база данных не доступна.' });
        return;
      }

      const db = client.db;

      // Быстрая проверка статистики
      const allUserStats = Object.keys(db.data.userStats || {});
      const serverStats = allUserStats.filter(key => key.startsWith(guildId + '_'));
      console.log(`📊 Статистика для ${guildId}: ${serverStats.length} записей`);

      // Если нет статистики для текущего сервера, проверяем другие серверы
      if (serverStats.length === 0) {
        const allServers = [...new Set(allUserStats.map(key => key.split('_')[0]))];
        console.log(`📊 Найдены данные для серверов: ${allServers.join(', ')}`);
        
        if (allServers.length > 0) {
          await interaction.editReply({ 
            content: `❌ Нет статистики для этого сервера.\n\nВ базе есть данные для серверов: ${allServers.join(', ')}\nТекущий сервер: ${guildId}\n\nВозможно, ID сервера изменился или ActivityTracker не работает.` 
          });
          return;
        }
      }

      // Получаем участников сервера (ограничиваем количество для скорости)
      let allMembers = [];
      try {
        allMembers = Array.from(guild.members.cache.values()).slice(0, 100); // Ограничиваем для скорости
        console.log(`👥 Обрабатываем ${allMembers.length} участников`);
      } catch (error) {
        console.error('❌ Ошибка получения участников:', error);
        await interaction.editReply({ content: '❌ Не удалось получить список участников сервера.' });
        return;
      }

      // Создаем массив статистики
      const memberStats = [];
      for (const member of allMembers) {
        if (member.user.bot) continue;

        const userStats = db.getUserStats(guildId, member.id) || {
          messages: 0,
          voiceTime: 0,
          lastActive: null
        };

        memberStats.push({
          user: member.user,
          member: member,
          messages: userStats.messages || 0,
          voiceTime: userStats.voiceTime || 0,
          lastActive: userStats.lastActive
        });
      }

      // Фильтруем активных пользователей
      let activeMembers = [];
      if (selectedType === 'messages') {
        activeMembers = memberStats.filter(s => s.messages > 0);
      } else if (selectedType === 'voice') {
        activeMembers = memberStats.filter(s => s.voiceTime > 0);
      }

      console.log(`📊 Активных пользователей: ${activeMembers.length}`);

      if (activeMembers.length === 0) {
        let noDataMessage = '';
        if (selectedType === 'messages') {
          noDataMessage = '📭 **Нет данных по сообщениям**\n\nСтатистика сообщений пока не собрана или никто не писал сообщения.';
        } else if (selectedType === 'voice') {
          noDataMessage = '📭 **Нет данных по голосовой активности**\n\nСтатистика голосовых каналов пока не собрана или никто не был в войсе.';
        }

        const embed = new EmbedBuilder()
          .setTitle('📊 Статистика активности')
          .setDescription(noDataMessage)
          .setColor(0x5865F2)
          .setTimestamp()
          .setFooter({ text: `Всего участников: ${memberStats.length}` });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Сортируем и берем топ
      if (selectedType === 'messages') {
        activeMembers.sort((a, b) => b.messages - a.messages);
      } else if (selectedType === 'voice') {
        activeMembers.sort((a, b) => b.voiceTime - a.voiceTime);
      }

      const topMembers = activeMembers.slice(0, limit);

      // Создаем embed
      let title = '📊 Статистика активности';
      if (selectedType === 'messages') {
        const customEmoji = guild.emojis.cache.find(emoji => emoji.name === 'emodzipurpleverify');
        const emojiStr = customEmoji ? `<:${customEmoji.name}:${customEmoji.id}>` : '';
        title = `${emojiStr} Топ пользователей по сообщениям`;
      } else if (selectedType === 'voice') {
        const customEmoji = guild.emojis.cache.find(emoji => emoji.name === 'emodzipurpleverify');
        const emojiStr = customEmoji ? `<:${customEmoji.name}:${customEmoji.id}>` : '';
        title = `${emojiStr} Топ пользователей по времени в войсе`;
      }

      let statsText = `Топ-${Math.min(limit, topMembers.length)}\n\n`;

      topMembers.forEach((stats, index) => {
        const position = index + 1;
        const userMention = `<@${stats.user.id}>`;

        if (selectedType === 'messages') {
          statsText += `**${position})** ${userMention} — **${stats.messages}** сообщений\n`;
        } else if (selectedType === 'voice') {
          const totalSeconds = Math.floor(stats.voiceTime / 1000);
          const days = Math.floor(totalSeconds / 86400);
          const hours = Math.floor((totalSeconds % 86400) / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          
          let timeStr = '';
          if (days > 0) {
            timeStr = `${days} дней, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          } else {
            timeStr = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          }
          
          statsText += `**${position})** ${userMention} — **${timeStr}**\n`;
        }
      });

      const resultEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(statsText)
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({ text: `Всего участников: ${memberStats.length}` });

      await interaction.editReply({ embeds: [resultEmbed] });

    } catch (error) {
      console.error('❌ Ошибка команды /stats:', error);

      try {
        const errorMessage = error.message.includes('Unknown interaction') 
          ? '❌ Команда выполнялась слишком долго. Попробуйте еще раз.' 
          : '❌ Произошла ошибка при получении статистики.';
          
        await interaction.editReply({ content: errorMessage });
      } catch (replyError) {
        console.error('❌ Ошибка отправки ошибки:', replyError);
      }
    }
  },
};