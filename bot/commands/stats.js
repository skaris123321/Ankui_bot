const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Показать статистику активности пользователей на сервере')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Тип статистики')
        .setRequired(true)
        .addChoices(
          { name: '💬 По сообщениям', value: 'messages' },
          { name: '🎤 По времени в войсе', value: 'voice' }
        )
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Количество пользователей для отображения (по умолчанию 10)')
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false)
    ),

  async execute(interaction, client) {
    let hasReplied = false;
    
    try {
      // Быстро отвечаем, чтобы избежать timeout
      await interaction.deferReply();
      hasReplied = true;

      const type = interaction.options.getString('type');
      const limit = interaction.options.getInteger('limit') || 10;
      const guild = interaction.guild;
      const guildId = guild.id;

      console.log(`📊 Команда /stats вызвана: тип=${type}, лимит=${limit}, сервер=${guildId}`);

      // Проверяем, что тип указан
      if (!type) {
        console.error('❌ Тип статистики не указан');
        await interaction.editReply({ content: '❌ Ошибка: не указан тип статистики.' });
        return;
      }

      // Проверяем, что база данных доступна
      if (!client.db) {
        console.error('❌ База данных не инициализирована');
        await interaction.editReply({ content: '❌ Ошибка: база данных не доступна.' });
        return;
      }

      // Проверяем права бота
      const botMember = guild.members.me;
      if (!botMember) {
        console.error('❌ Не удалось получить информацию о боте на сервере');
        await interaction.editReply({ content: '❌ Ошибка: не удалось получить информацию о боте.' });
        return;
      }

      const db = client.db;

      // Получаем участников сервера более безопасным способом
      let allMembers = [];
      try {
        // Сначала пробуем получить из кэша
        allMembers = Array.from(guild.members.cache.values());
        console.log(`👥 Участников в кэше: ${allMembers.length}`);

        // Если в кэше мало участников, пробуем загрузить больше (но с ограничением времени)
        if (allMembers.length < 10) {
          console.log('🔄 Загружаем участников с сервера...');
          try {
            // Устанавливаем таймаут для загрузки участников
            const fetchPromise = guild.members.fetch({ limit: 100 });
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            );
            
            await Promise.race([fetchPromise, timeoutPromise]);
            allMembers = Array.from(guild.members.cache.values());
            console.log(`👥 Участников после загрузки: ${allMembers.length}`);
          } catch (fetchError) {
            console.warn('⚠️ Не удалось загрузить всех участников:', fetchError.message);
            // Продолжаем с теми, что есть в кэше
          }
        }
      } catch (error) {
        console.error('❌ Ошибка получения участников:', error);
        // Используем базовую информацию
        allMembers = Array.from(guild.members.cache.values());
      }

      console.log(`👥 Всего участников для анализа: ${allMembers.length}`);

      // Создаем массив статистики для всех участников
      const memberStats = [];

      for (const member of allMembers) {
        if (member.user.bot) continue; // Пропускаем ботов

        try {
          // Получаем статистику пользователя
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
          // Пропускаем этого участника и продолжаем
          continue;
        }
      }

      console.log(`📊 Обработано пользователей: ${memberStats.length}`);

      // Сортируем в зависимости от типа статистики
      if (type === 'messages') {
        memberStats.sort((a, b) => b.messages - a.messages);
        console.log(`📊 Сортировка по сообщениям. Топ-3: ${memberStats.slice(0, 3).map(s => `${s.user.username}:${s.messages}`).join(', ')}`);
      } else if (type === 'voice') {
        memberStats.sort((a, b) => b.voiceTime - a.voiceTime);
        console.log(`📊 Сортировка по войсу. Топ-3: ${memberStats.slice(0, 3).map(s => `${s.user.username}:${Math.floor(s.voiceTime/60000)}м`).join(', ')}`);
      }

      // Берем топ пользователей
      const topMembers = memberStats.slice(0, limit);

      // Создаем embed в зависимости от типа
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({
          text: `Всего участников: ${memberStats.length}`,
          iconURL: guild.iconURL() || undefined
        });

      let title = 'Статистика активности';
      let description = 'Статистика пользователей';

      if (type === 'messages') {
        title = `💬 Топ по сообщениям`;
        description = `Самые активные в чате (топ-${limit})`;
      } else if (type === 'voice') {
        title = `🎤 Топ по времени в войсе`;
        description = `Больше всего времени в голосовых каналах (топ-${limit})`;
      }

      // Проверяем, что title не пустой
      if (!title || title.trim() === '') {
        title = 'Статистика активности';
      }

      embed.setTitle(title);

      // Добавляем поля со статистикой
      if (topMembers.length === 0) {
        embed.setDescription('📭 Нет данных\n\nСтатистика активности пока не собрана.');
      } else {
        let statsText = description + '\n\n';

        topMembers.forEach((stats, index) => {
          const position = index + 1;
          const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `**${position}.**`;

          try {
            // Проверяем, что у пользователя есть имя
            const username = stats.user.username || stats.user.displayName || 'Неизвестный пользователь';
            
            if (type === 'messages') {
              // Статистика по сообщениям
              if (stats.messages > 0) {
                statsText += `${medal} ${username} — **${stats.messages}** сообщений\n`;
              } else {
                statsText += `${medal} ${username} — нет сообщений\n`;
              }
            } else if (type === 'voice') {
              // Статистика по времени в войсе
              const voiceHours = Math.floor(stats.voiceTime / 3600000);
              const voiceMinutes = Math.floor((stats.voiceTime % 3600000) / 60000);
              
              if (stats.voiceTime > 0) {
                if (voiceHours > 0) {
                  statsText += `${medal} ${username} — **${voiceHours}ч ${voiceMinutes}м**\n`;
                } else {
                  statsText += `${medal} ${username} — **${voiceMinutes}м**\n`;
                }
              } else {
                statsText += `${medal} ${username} — не был в войсе\n`;
              }
            }
          } catch (userError) {
            console.warn(`⚠️ Ошибка обработки пользователя в статистике:`, userError.message);
            // Пропускаем этого пользователя
          }
        });

        // Проверяем, что описание не пустое
        if (statsText.trim() === '') {
          statsText = 'Нет данных для отображения';
        }

        embed.setDescription(statsText);
      }

      // Добавляем общую статистику сервера
      try {
        const totalMessages = memberStats.reduce((sum, stats) => sum + stats.messages, 0);
        const totalVoiceTime = memberStats.reduce((sum, stats) => sum + stats.voiceTime, 0);
        const totalVoiceHours = Math.floor(totalVoiceTime / 3600000);
        const totalVoiceMinutes = Math.floor((totalVoiceTime % 3600000) / 60000);

        if (type === 'messages') {
          embed.addFields({
            name: '📊 Общая статистика',
            value: `Всего сообщений на сервере: **${totalMessages}**`,
            inline: false
          });
        } else if (type === 'voice') {
          const totalVoiceStr = totalVoiceHours > 0 ? `**${totalVoiceHours}ч ${totalVoiceMinutes}м**` : `**${totalVoiceMinutes}м**`;
          embed.addFields({
            name: '📊 Общая статистика',
            value: `Общее время в войсе: ${totalVoiceStr}`,
            inline: false
          });
        }
      } catch (statsError) {
        console.warn('⚠️ Ошибка подсчета общей статистики:', statsError.message);
        // Продолжаем без общей статистики
      }

      console.log(`✅ Отправка embed со статистикой`);
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Ошибка выполнения команды /stats:', error);
      console.error('❌ Stack trace:', error.stack);

      let errorMessage = 'Произошла ошибка при получении статистики.';
      
      // Более понятные сообщения об ошибках
      if (error.message.includes('Missing Permissions')) {
        errorMessage = '❌ У бота недостаточно прав для получения информации об участниках сервера.';
      } else if (error.message.includes('Unknown Guild')) {
        errorMessage = '❌ Сервер не найден.';
      } else if (error.message.includes('Unknown interaction')) {
        errorMessage = '❌ Команда выполнялась слишком долго. Попробуйте еще раз.';
      } else if (error.message.includes('Received one or more errors')) {
        errorMessage = '❌ Не удалось получить полную информацию об участниках. Попробуйте позже.';
      }

      try {
        if (hasReplied) {
          await interaction.editReply({ content: errorMessage });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        console.error('❌ Ошибка отправки сообщения об ошибке:', replyError);
      }
    }
  },
};