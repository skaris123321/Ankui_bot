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
    try {
      await interaction.deferReply();

      const type = interaction.options.getString('type');
      const limit = interaction.options.getInteger('limit') || 10;
      const guildId = interaction.guild.id;

      // Получаем всех участников сервера
      const guild = interaction.guild;
      await guild.members.fetch(); // Загружаем всех участников

      // Получаем статистику из базы данных
      const db = client.db;
      const allMembers = Array.from(guild.members.cache.values());

      // Создаем массив статистики для всех участников
      const memberStats = [];

      for (const member of allMembers) {
        if (member.user.bot) continue; // Пропускаем ботов

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
      }

      // Сортируем в зависимости от типа статистики
      if (type === 'messages') {
        memberStats.sort((a, b) => b.messages - a.messages);
      } else if (type === 'voice') {
        memberStats.sort((a, b) => b.voiceTime - a.voiceTime);
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

      if (type === 'messages') {
        embed.setTitle(`💬 Топ по сообщениям`)
          .setDescription(`Самые активные в чате (топ-${limit})`);
      } else if (type === 'voice') {
        embed.setTitle(`🎤 Топ по времени в войсе`)
          .setDescription(`Больше всего времени в голосовых каналах (топ-${limit})`);
      }

      // Добавляем поля со статистикой
      if (topMembers.length === 0) {
        embed.addFields({
          name: '📭 Нет данных',
          value: 'Статистика активности пока не собрана.',
          inline: false
        });
      } else {
        let description = '';

        topMembers.forEach((stats, index) => {
          const position = index + 1;
          const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `**${position}.**`;

          if (type === 'messages') {
            // Статистика по сообщениям
            if (stats.messages > 0) {
              description += `${medal} <@${stats.user.id}> — **${stats.messages}** сообщений\n`;
            } else {
              description += `${medal} <@${stats.user.id}> — нет сообщений\n`;
            }
          } else if (type === 'voice') {
            // Статистика по времени в войсе
            const voiceHours = Math.floor(stats.voiceTime / 3600000);
            const voiceMinutes = Math.floor((stats.voiceTime % 3600000) / 60000);
            
            if (stats.voiceTime > 0) {
              if (voiceHours > 0) {
                description += `${medal} <@${stats.user.id}> — **${voiceHours}ч ${voiceMinutes}м**\n`;
              } else {
                description += `${medal} <@${stats.user.id}> — **${voiceMinutes}м**\n`;
              }
            } else {
              description += `${medal} <@${stats.user.id}> — не был в войсе\n`;
            }
          }
        });

        embed.setDescription(embed.data.description + '\n' + description);
      }

      // Добавляем общую статистику сервера
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

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Ошибка выполнения команды /stats:', error);

      const errorMessage = 'Произошла ошибка при получении статистики.';

      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};