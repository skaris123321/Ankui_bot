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
    let hasReplied = false;
    
    try {
      // Быстро отвечаем, чтобы избежать timeout
      await interaction.deferReply();
      hasReplied = true;

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: '❌ Ошибка: команда должна выполняться на сервере.' });
        return;
      }

      const guildId = guild.id;
      const selectedType = interaction.options.getString('тип');
      const limit = interaction.options.getInteger('лимит') || 20;

      console.log(`📊 Команда /stats вызвана: тип=${selectedType}, лимит=${limit}, сервер=${guildId}`);

      // Проверяем, что база данных доступна
      if (!client.db) {
        console.error('❌ База данных не инициализирована');
        await interaction.editReply({ content: '❌ Ошибка: база данных не доступна.' });
        return;
      }

      const db = client.db;

      // Получаем участников сервера
      let allMembers = [];
      try {
        // Пытаемся получить участников из кэша
        allMembers = Array.from(guild.members.cache.values());
        console.log(`👥 Участников в кэше: ${allMembers.length}`);
        
        // Если в кэше мало участников, пытаемся загрузить их
        if (allMembers.length < 10) {
          console.log('🔄 Загружаем участников с сервера...');
          try {
            await guild.members.fetch({ limit: 100 });
            allMembers = Array.from(guild.members.cache.values());
            console.log(`👥 Участников после загрузки: ${allMembers.length}`);
          } catch (fetchError) {
            console.warn('⚠️ Не удалось загрузить участников:', fetchError.message);
            // Продолжаем с тем, что есть в кэше
          }
        }
      } catch (error) {
        console.error('❌ Ошибка получения участников:', error);
        allMembers = [];
      }

      if (allMembers.length === 0) {
        await interaction.editReply({ 
          content: '❌ Не удалось получить список участников сервера. Попробуйте позже.' 
        });
        return;
      }

      // Создаем массив статистики для всех участников
      const memberStats = [];

      for (const member of allMembers) {
        if (member.user.bot) continue; // Пропускаем ботов

        try {
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
        } catch (memberError) {
          console.warn(`⚠️ Ошибка обработки участника ${member.id}:`, memberError.message);
          continue;
        }
      }

      console.log(`📊 Обработано пользователей: ${memberStats.length}`);

      // Фильтруем пользователей с активностью в зависимости от типа статистики
      let activeMembers = [];
      if (selectedType === 'messages') {
        activeMembers = memberStats.filter(s => s.messages > 0);
        console.log(`💬 Пользователей с сообщениями: ${activeMembers.length}`);
      } else if (selectedType === 'voice') {
        activeMembers = memberStats.filter(s => s.voiceTime > 0);
        console.log(`🎤 Пользователей с голосовой активностью: ${activeMembers.length}`);
      }

      // Сортируем отфильтрованных пользователей
      if (selectedType === 'messages') {
        activeMembers.sort((a, b) => b.messages - a.messages);
      } else if (selectedType === 'voice') {
        activeMembers.sort((a, b) => b.voiceTime - a.voiceTime);
      }

      // Берем топ пользователей
      const topMembers = activeMembers.slice(0, limit);

      // Создаем embed с результатами
      let title = '📊 Статистика активности';
      let description = '';

      if (selectedType === 'messages') {
        title = '<:emodzipurpleverify:1467380679191826446> Топ пользователей по сообщениям';
        description = `Самые активные в чате (топ-${Math.min(limit, topMembers.length)})`;
      } else if (selectedType === 'voice') {
        title = '🎤 Топ пользователей по времени в войсе';
        description = `Больше всего времени в голосовых каналах (топ-${Math.min(limit, topMembers.length)})`;
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle(title)
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({
          text: `Всего участников: ${memberStats.length}`
        });

      // Добавляем статистику
      if (topMembers.length === 0) {
        let noDataMessage = '';
        if (selectedType === 'messages') {
          noDataMessage = '📭 **Нет данных по сообщениям**\n\nСтатистика сообщений пока не собрана или никто не писал сообщения.';
        } else if (selectedType === 'voice') {
          noDataMessage = '📭 **Нет данных по голосовой активности**\n\nСтатистика голосовых каналов пока не собрана или никто не был в войсе.';
        }
        resultEmbed.setDescription(noDataMessage);
      } else {
        let statsText = description + '\n\n';

        topMembers.forEach((stats, index) => {
          const position = index + 1;
          // Используем mention для отображения пользователя как кликабельной ссылки
          const userMention = `<@${stats.user.id}>`;

          if (selectedType === 'messages') {
            statsText += `**${position})** ${userMention} — **${stats.messages}** сообщений\n`;
          } else if (selectedType === 'voice') {
            // Конвертируем миллисекунды в дни, часы, минуты, секунды
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
            
            statsText += `**${position})** ${userMention} — **${timeStr}** 🎤\n`;
          }
        });

        resultEmbed.setDescription(statsText);
      }

      await interaction.editReply({ embeds: [resultEmbed] });

    } catch (error) {
      console.error('❌ Ошибка выполнения команды /stats:', error);
      console.error('❌ Stack trace:', error.stack);

      let errorMessage = 'Произошла ошибка при получении статистики.';
      
      if (error.message.includes('Unknown interaction')) {
        errorMessage = '❌ Команда выполнялась слишком долго. Попробуйте еще раз.';
      }

      try {
        if (hasReplied) {
          await interaction.editReply({ content: errorMessage, components: [] });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        console.error('❌ Ошибка отправки сообщения об ошибке:', replyError);
      }
    }
  },
};