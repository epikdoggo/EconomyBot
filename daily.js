const { EmbedBuilder, Client, Intents } = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');
const dailyAmount = 15;

module.exports = {
    data: {
        name: 'daily',
        description: 'Collect your free 15 coins daily!',
    },

    run: async ({ interaction, client }) => {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: "This command can only be executed inside a server.",
                ephemeral: true,
            });
            return;
        }

        try {
            await interaction.deferReply();

            let userProfile = await UserProfile.findOne({
                userId: interaction.member.id,
            });

            const oldBalance = userProfile ? userProfile.balance : 0;

            if (userProfile) {
                const lastDailyDate = userProfile.lastDailyCollected?.toDateString();
                const currentDate = new Date().toDateString();

                if (lastDailyDate === currentDate) {
                    await interaction.editReply("You have already collected your free coins for today.");
                    return;
                }
            } else {
                userProfile = new UserProfile({
                    userId: interaction.member.id,
                });
            }

            userProfile.balance += dailyAmount;
            userProfile.lastDailyCollected = new Date();

            await userProfile.save();

            // Create an embed with a predefined color
            const embed = new EmbedBuilder()
                .setColor('#7289DA')
                .setDescription(`<:Coin:1255306017084936212> **${dailyAmount}** coins was added to your balance. <:Coin:1255306017084936212>`)
                .addFields(
                    { name: 'New Balance', value: `> **${userProfile.balance}** coins.` }
                )
                .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Logging the balance update
            const logChannelId = process.env.LOGCHANNEL;

            // Fetch the channel by its ID
            const logChannel = await client.channels.fetch(logChannelId);
            if (logChannel && logChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Balance Update Log')
                    .addFields(
                        { name: 'User', value: `> ${interaction.user.tag} (${interaction.user.id})` },
                        { name: 'Old Balance', value: `> ${oldBalance} coins` },
                        { name: 'New Balance', value: `> ${userProfile.balance} coins` },
                        { name: 'Command Used', value: '> /daily' }
                    )
                    .setThumbnail(interaction.user.avatarURL())
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            console.log(`Error handling /daily: ${error}`);
            await interaction.editReply("An error occurred while processing your request.");
        }
    },
};
