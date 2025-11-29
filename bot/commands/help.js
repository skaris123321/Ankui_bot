const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
        { name: '🎨 /embed', value: 'Создать красивое оформленное сообщение с настройками цвета, картинки и текста' },
        { name: '📊 /serverinfo', value: 'Получить информацию о сервере' },
        { name: '👤 /userinfo', value: 'Получить информацию о пользователе' },
        { name: '🏓 /ping', value: 'Проверить задержку бота' },
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

