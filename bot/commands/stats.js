const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// Локальная защита от двойной обработки одной и той же интеракции
const processedInteractions = new Set();

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
    // КРИТИЧЕСКИ ВАЖНО: deferReply должен быть вызван СРАЗУ, без задержек
    // Discord дает только 3 секунды на ответ, иначе взаимодействие истекает
    // НЕ ДОБАВЛЯЙТЕ ЛОГИРОВАНИЕ ПЕРЕД deferReply() - это может вызвать таймаут!
    // Если интеракция уже слишком старая или была обработана, не продолжаем (защита от дубликатов/второго инстанса)
    if (processedInteractions.has(interaction.id)) {
      console.warn(`⚠️ Пропуск /stats: интеракция ${interaction.id} уже обработана (Set)`);
      return;
    }
    processedInteractions.add(interaction.id);
    setTimeout(() => processedInteractions.delete(interaction.id), 15000);

    const interactionAge = Date.now() - (interaction.createdTimestamp || Date.now());
    if (interactionAge > 2500) {
      console.warn(`⚠️ Пропуск /stats: интеракция старше ${interactionAge} мс (более 2.5с)`);
      return;
    }
    if (interaction.deferred || interaction.replied) {
      console.warn('⚠️ Пропуск /stats: интеракция уже обработана (deferred/replied)');
      return;
    }

    try {
      await interaction.deferReply();
      console.log('✅ Команда /stats: ответ отложен');
    } catch (deferError) {
      // Unknown interaction (10062) = взаимодействие уже обработано другим экземпляром или истекло
      // Это нормальная ситуация при нескольких экземплярах бота, не логируем как ошибку
      if (deferError.code === 10062) {
        // Тихая обработка - не логируем, просто выходим
        return;
      }
      // Для других ошибок логируем и пытаемся ответить
      console.error('❌ Ошибка при отложенном ответе (не 10062):', deferError.message || deferError);
      // Для других ошибок пытаемся отправить обычный ответ
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: '❌ Произошла ошибка при обработке команды!', 
            flags: MessageFlags.Ephemeral 
          });
        }
      } catch (replyError) {
        // Игнорируем ошибки ответа, если взаимодействие уже обработано
        if (replyError.code !== 10062) {
          console.error('❌ Не удалось отправить ответ об ошибке:', replyError.message || replyError);
        }
      }
      return;
    }
    
    try {
      // Проверяем, что база данных доступна
      if (!client || !client.db) {
        console.error('❌ База данных не инициализирована');
        return interaction.editReply({ 
          content: '❌ Ошибка: база данных не доступна. Обратитесь к администратору.' 
        });
      }

      const guildId = interaction.guild?.id;
      if (!guildId) {
        return interaction.editReply({ 
          content: '❌ Ошибка: не удалось получить информацию о сервере.' 
        });
      }

      const channel = interaction.channel;
      const allowedChannelId = '1444744987677032538';
      
      if (channel.id !== allowedChannelId && channel.name !== 'spam-chat' && !channel.name.toLowerCase().includes('spam')) {
        return interaction.editReply({ 
          content: '❌ Эта команда доступна только в канале spam-chat!' 
        });
      }

      const statsType = interaction.options.getString('тип') || 'messages';
      
      // Загружаем данные из базы
      try {
        client.db.load();
      } catch (dbError) {
        console.error('❌ Ошибка загрузки базы данных:', dbError);
        return interaction.editReply({ 
          content: '❌ Ошибка при загрузке данных. Попробуйте позже.' 
        });
      }

      if (!client.db.data || !client.db.data.userLevels) {
        return interaction.editReply({ 
          content: '❌ Нет данных для отображения статистики.' 
        });
      }

      console.log(`📊 Запрос статистики для сервера: ${guildId}, тип: ${statsType}`);

      // Фильтруем пользователей по серверу
      const allUsers = Object.values(client.db.data.userLevels)
        .filter(user => user && user.guild_id === guildId);

      console.log(`📊 Пользователей после фильтрации: ${allUsers.length}`);

      let sortedUsers = [];
      let title = '';

      if (statsType === 'messages') {
        sortedUsers = allUsers
          .filter(user => user && (user.messages || 0) > 0)
          .sort((a, b) => (b.messages || 0) - (a.messages || 0))
          .slice(0, 140);
        title = 'Топ пользователей по сообщениям';
      } else if (statsType === 'voice') {
        sortedUsers = allUsers
          .filter(user => user && (user.voiceTime || 0) > 0)
          .sort((a, b) => (b.voiceTime || 0) - (a.voiceTime || 0))
          .slice(0, 140);
        title = 'Топ пользователей по онлайну';
      }

      if (sortedUsers.length === 0) {
        return interaction.editReply({ 
          content: '❌ Нет данных для отображения статистики. Начните общаться на сервере, чтобы появилась статистика!'
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

      let embed, totalPages;
      try {
        const result = createEmbed(0);
        embed = result.embed;
        totalPages = result.totalPages;
      } catch (embedError) {
        console.error('❌ Ошибка создания embed:', embedError);
        return interaction.editReply({ 
          content: '❌ Ошибка при создании статистики. Попробуйте позже.' 
        });
      }

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

      try {
        await interaction.editReply({ embeds: [embed], components: [row] });
        console.log('✅ Статистика успешно отправлена');
      } catch (replyError) {
        // Ошибка 10062 - взаимодействие уже обработано или истекло, это нормально
        if (replyError.code === 10062) {
          // Тихая обработка - не логируем
          return;
        }
        // Для других ошибок логируем
        console.error('❌ Ошибка отправки ответа (не 10062):', replyError.message || replyError);
      }
    } catch (error) {
      // Ошибка 10062 - взаимодействие уже обработано, не логируем как ошибку
      if (error.code === 10062) {
        return;
      }
      console.error('❌ Ошибка в команде /stats:', error.message || error);
      try {
        if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({ 
            content: '❌ Произошла ошибка при выполнении команды статистики!'
          });
        } else if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: '❌ Произошла ошибка при выполнении команды статистики!', 
            flags: MessageFlags.Ephemeral 
          });
        }
      } catch (replyError) {
        // Игнорируем ошибки ответа, если взаимодействие уже обработано
        if (replyError.code !== 10062) {
          console.error('❌ Не удалось отправить сообщение об ошибке:', replyError.message || replyError);
        }
      }
    }
  },
};
