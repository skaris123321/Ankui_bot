const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Показать список всех команд бота'),
  
  async execute(interaction, client) {
    console.log('🔧 Команда /help вызвана');
    try {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📚 Справка по командам')
        .setDescription('🎨 **Бот для создания красивых сообщений**\n\nИспользуйте команды ниже для создания оформленных сообщений на вашем сервере!')
        .addFields(
          { name: '📊 /stats', value: 'Показать статистику пользователей (топ по сообщениям и онлайну)' },
          { name: '📚 /help', value: 'Показать это сообщение' }
        )
        .setTimestamp();

      // Безопасное получение аватара бота
      if (client.user) {
        embed.setFooter({ 
          text: `Управление через веб-панель: http://localhost:${process.env.PORT || 3000}`,
          iconURL: client.user.displayAvatarURL()
        });
      } else {
        embed.setFooter({ 
          text: `Управление через веб-панель: http://localhost:${process.env.PORT || 3000}`
        });
      }

      console.log('📤 Отправка ответа на команду /help...');
      await interaction.reply({ embeds: [embed] });
      console.log('✅ Ответ на команду /help отправлен');
    } catch (error) {
      console.error('❌ Ошибка в команде /help:', error);
      console.error('Stack trace:', error.stack);
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ 
            content: '❌ Произошла ошибка при выполнении команды!', 
            flags: MessageFlags.Ephemeral 
          });
        } catch (replyError) {
          console.error('❌ Ошибка при отправке ответа об ошибке:', replyError);
        }
      } else if (interaction.deferred) {
        try {
          await interaction.editReply({ 
            content: '❌ Произошла ошибка при выполнении команды!'
          });
        } catch (editError) {
          console.error('❌ Ошибка при редактировании ответа:', editError);
        }
      }
    }
  },
};

