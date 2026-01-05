const { SlashCommandBuilder, EmbedBuilder, InteractionResponseFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Показать список всех команд бота'),
  
  async execute(interaction, client) {
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

    await interaction.reply({ embeds: [embed] });
  },
};

