const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');

module.exports = {
    data: {
        name: 'coingamble',
        description: 'Gamble your coins on a coin flip',
        options: [
            {
                name: 'bet',
                description: 'The amount of coins to bet',
                type: ApplicationCommandOptionType.Integer,
                required: true,
            },
            {
                name: 'choice',
                description: 'Choose heads or tails',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' },
                ],
            },
        ],
    },

    run: async ({ interaction, client }) => {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: "This command can only be executed inside a server.",
                ephemeral: true,
            });
            return;
        }

        const userId = interaction.user.id;
        const betAmount = interaction.options.getInteger('bet');
        const userChoice = interaction.options.getString('choice');
        const logChannelId = process.env.LOGCHANNEL;

        if (betAmount < 10000 || isNaN(betAmount)) {
            return interaction.reply('Please specify a valid bet amount of at least 10,000 coins.');
        }

        await interaction.deferReply();

        try {
            let userProfile = await UserProfile.findOne({ userId });

            if (!userProfile) {
                userProfile = new UserProfile({ userId });
            }

            const oldBalance = userProfile.balance || 0;

            if (betAmount > oldBalance) {
                return interaction.editReply('You do not have enough coins.');
            }

            const now = new Date();
            const cooldown = 10 * 1000; // 10 seconds in milliseconds

            if (userProfile.lastCoinGamble && (now - new Date(userProfile.lastCoinGamble)) < cooldown) {
                const remainingTime = cooldown - (now - new Date(userProfile.lastCoinGamble));
                const seconds = Math.floor(remainingTime / 1000);

                const cooldownEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('Cooldown')
                    .setDescription(`You are on a cooldown! Please wait ${seconds}s before playing again.`)
                    .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
                    .setTimestamp();

                await interaction.editReply({ embeds: [cooldownEmbed] });

                return; // Exit the function to prevent further processing
            }

            const flipResult = Math.random() < 0.4 ? userChoice : (userChoice === 'heads' ? 'tails' : 'heads'); // 40% chance to win
            const isWin = flipResult === userChoice;
            let resultMessage;
            let embedColor;

            if (isWin) {
                userProfile.balance += betAmount;
                resultMessage = `Congratulations! The coin landed on **${flipResult}**. You won ${betAmount} coins <:Coin:1255306017084936212>.`;
                embedColor = '#00ff00'; // Green for win
            } else {
                userProfile.balance -= betAmount;
                resultMessage = `Sorry! The coin landed on **${flipResult}**. You lost ${betAmount} coins <:Coin:1255306017084936212>.`;
                embedColor = '#ff0000'; // Red for loss
            }

            userProfile.lastCoinGamble = now; // Update the cooldown timestamp

            // Save the updated profile
            await userProfile.save();

            // Construct the result embed
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle('Coin Flip Result')
                .setDescription(resultMessage)
                .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Log the result
            const logChannel = await client.channels.fetch(logChannelId);
            if (logChannel && logChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('Coin Gamble Log')
                    .addFields(
                        { name: 'User', value: `> ${interaction.user.tag} (${interaction.user.id})` },
                        { name: 'Bet Amount', value: `> ${betAmount} coins` },
                        { name: 'Choice', value: `> ${userChoice}` },
                        { name: 'Result', value: `> ${flipResult}` },
                        { name: 'Outcome', value: isWin ? '> Win' : '> Loss' },
                        { name: 'Old Balance', value: `> ${oldBalance} coins` },
                        { name: 'New Balance', value: `> ${userProfile.balance} coins` },
                        { name: 'Command Used', value: '> /coingamble' }
                    )
                    .setThumbnail(interaction.user.avatarURL())
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            console.log(`Error handling /coingamble: ${error}`);
            await interaction.editReply("An error occurred while processing your request.");
        }
    },
};
