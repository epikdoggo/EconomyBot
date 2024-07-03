const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: {
        name: 'help',
        description: 'Provides information about available commands',
    },
    run: async ({ interaction }) => {
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('📋 Help - Available Commands')
            .setDescription('Here are the available commands and their descriptions:')
            .addFields(
                { name: '💰 /inventory', value: 'Check your bluesteel balance and items. Optionally, you can check another user\'s inventory by mentioning them.' },
                { name: '🎁 /daily', value: 'Collect your free 15 bluesteel daily.' },
                { name: '🎰 /slotgamble', value: 'Gamble a specified amount of bluesteel. Minimum bet is 500 bluesteel.' },
                { name: '🟡 /coingamble', value: 'Gamble a specified amount of bluesteel in a 50/50 odds! Minimum bet is 10,000 bluesteel.' },
                { name: '🃏 /bjgamble', value: 'Play a game of blackjack. Minimum bet is 300 bluesteel.' },
                { name: '🏆 /top', value: 'Display the top 5 members with the most bluesteel.' },
                { name: '🔄 /transfer', value: 'Transfer a specified amount of an item to another user.' },
                { name: '📈 /marketplace', value: 'Purchase TSG items to withdraw or transfer.' }
            )
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
