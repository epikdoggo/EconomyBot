const { EmbedBuilder } = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');

module.exports = {
    data: {
        name: 'top',
        description: 'Displays the top 5 members in the guild with the most amount of coins.',
    },

    run: async ({ interaction }) => {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: "This command can only be executed inside a server.",
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        try {
            // Fetch the top 5 users with the highest balance
            const topUsers = await UserProfile.find()
                .sort({ balance: -1 })
                .limit(5);

            if (topUsers.length === 0) {
                await interaction.editReply("No users found with coins.");
                return;
            }

            // Create an embed
            const embed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle('Top 5 Members with the most coins <:Coin:1255306017084936212>.')
                .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.avatarURL() })
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
                .setTimestamp();

            // Add fields to the embed for each top user
            for (const [index, userProfile] of topUsers.entries()) {
                let member = interaction.guild.members.cache.get(userProfile.userId);

                if (!member) {
                    try {
                        member = await interaction.guild.members.fetch(userProfile.userId);
                    } catch (err) {
                        console.error(`Could not fetch member with ID ${userProfile.userId}:`, err);
                    }
                }

                const displayName = member ? member.displayName : `Could not find user (left) (${userProfile.userId})`;

                embed.addFields({
                    name: `#${index + 1} - ${displayName}`,
                    value: `> Coins: **${userProfile.balance}** <:Coin:1255306017084936212>`,
                    inline: false,
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.log(`Error handling /top: ${error}`);
            await interaction.editReply("An error occurred while processing your request.");
        }
    },
};
