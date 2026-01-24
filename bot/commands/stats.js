const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Показать статистику активности пользователей на сервере')
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

      // Сортируем по общей активности (сообщения + время в голосовых каналах)
      memberStats.sort((a, b) => {
        const scoreA = a.messages + Math.floor(a.voiceTime / 60000); // 1 минута = 1 очко
        const scoreB = b.messages + Math.floor(b.voiceTime / 60000);
        return scoreB - scoreA;
      });

      // Берем топ пользователей
      const topMembers = memberStats.slice(0, limit);

      // Создаем embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 Статистика активности сервера`)
        .setDescription(`Топ-${limit} самых активных участников`)
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({
          text: `Всего участников: ${memberStats.length}`,
          iconURL: guild.iconURL() || undefined
        });

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
          const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;

          // Форматируем время в голосовых каналах
          const voiceHours = Math.floor(stats.voiceTime / 3600000);
          const voiceMinutes = Math.floor((stats.voiceTime % 3600000) / 60000);
          const voiceTimeStr = voiceHours > 0 ? `${voiceHours}ч ${voiceMinutes}м` : `${voiceMinutes}м`;

          // Форматируем последнюю активность
          let lastActiveStr = 'Никогда';
          if (stats.lastActive) {
            const lastActiveDate = new Date(stats.lastActive);
            const now = new Date();
            const diffMs = now - lastActiveDate;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
              lastActiveStr = 'Сегодня';
            } else if (diffDays === 1) {
              lastActiveStr = 'Вчера';
            } else if (diffDays < 7) {
              lastActiveStr = `${diffDays} дн. назад`;
            } else {
              lastActiveStr = lastActiveDate.toLocaleDateString('ru-RU');
            }
          }

          description += `${medal} <@${stats.user.id}>\n`;
          description += `💬 **${stats.messages}** сообщений • 🎤 **${voiceTimeStr}** в войсе\n`;
          description += `🕒 Последняя активность: ${lastActiveStr}\n\n`;
        });

        embed.setDescription(description);
      }

      // Добавляем общую статистику сервера
      const totalMessages = memberStats.reduce((sum, stats) => sum + stats.messages, 0);
      const totalVoiceTime = memberStats.reduce((sum, stats) => sum + stats.voiceTime, 0);
      const totalVoiceHours = Math.floor(totalVoiceTime / 3600000);
      const totalVoiceMinutes = Math.floor((totalVoiceTime % 3600000) / 60000);
      const totalVoiceStr = totalVoiceHours > 0 ? `${totalVoiceHours}ч ${totalVoiceMinutes}м` : `${totalVoiceMinutes}м`;

      embed.addFields({
        name: '📈 Общая статистика',
        value: `💬 Всего сообщений: **${totalMessages}**\n🎤 Общее время в войсе: **${totalVoiceStr}**`,
        inline: false
      });

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