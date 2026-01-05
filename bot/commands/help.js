const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Показать список всех команд бота'),
  
  async execute(interaction, client) {
    try {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📚 Справка по командам')
        .setDescription('🎨 **Бот для создания красивых сообщений**\n\nИспользуйте команды ниже для создания оформленных сообщений на вашем сервере!')
        .addFields(
          { name: '📊 /stats', value: 'Показать статистику пользователей (топ по сообщениям и онлайну)' },
          { name: '📚 /help', value: 'Показать это сообщение' }
        )
        .setFooter({ 
          text: `Управление через веб-панель: http://localhost:${process.env.PORT || 3000}`,
          iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();

      // Отвечаем сразу, без deferReply (команда быстрая)
      await interaction.reply({ embeds: [embed], ephemeral: false });
    } catch (error) {
      console.error('❌ Ошибка в команде /help:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Произошла ошибка!', ephemeral: true }).catch(() => {});
      }
    }
  },
};

