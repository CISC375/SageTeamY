import { Command } from '@lib/types/Command';
import { ChatInputCommandInteraction,
	InteractionResponse,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType }
	from 'discord.js';

export default class extends Command {

	description = 'Challenge Sage to a round of Black Jack!';
	extendedHelp = 'Get a higher score than Sage, but do not exceed 21!';

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		// Stand-in values to worry about dealing later
		let playerHand = 5;
		let dealerHand = 10;

		const gameWindow = (player: number, dealer: number, gameOver = false) => new EmbedBuilder()
			.setColor(gameOver ? '#FF0000' : '#0099FF')
			.setTitle('Blackjack 🃏')
			.setDescription(gameOver ? 'Game Over!' : 'It\'s your turn!')
			.addFields(
				{ name: "Dealer's Hand", value: `**${dealer}**`, inline: true },
				{ name: `${interaction.user.username}'s Hand`, value: `**${player}**`, inline: true }
			)
			.setFooter({ text: 'Click "Hit" to draw a card or "Stand" to end your turn.' });

		// Hit button option to deal yourself a new card
		const hitButton = new ButtonBuilder()
			.setCustomId('blackjack_hit')
			.setLabel('Hit')
			.setStyle(ButtonStyle.Success) // Success = Green
			.setEmoji('➕');

		// Stand button option to end your turn and finalize your score
		const standButton = new ButtonBuilder()
			.setCustomId('blackjack_stand')
			.setLabel('Stand')
			.setStyle(ButtonStyle.Danger) // Danger = Red
			.setEmoji('🛑');
		
		// Creates a row with both buttons in game window
		const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(hitButton, standButton);

        // "Replies" to get the message back
        const response = await interaction.reply({
            embeds: [gameWindow(playerHand, dealerHand)],
            components: [row],
            fetchReply: true 
        });

        // Only accept interactions from the user who started the command.
        const filter = (i: any) => i.user.id === interaction.user.id;

		// Listens for button clicks
        try {
            // Max duration is 1 minute
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: filter,
                time: 60000 
            });

            // Handles button clicks
            collector.on('collect', async (i) => {
                // Checks which button was clicked
                if (i.customId === 'blackjack_hit') {
                    // TODO: Add "Hit" Logic
                    playerHand += Math.floor(Math.random() * 10) + 1; 

                    // Updates with new hand
                    await i.update({
                        embeds: [gameWindow(playerHand, dealerHand)]
                    });

                    // TODO: Add "Bust" logic

                } else if (i.customId === 'blackjack_stand') {
                    // TODO: Add "Stand logic"
                    collector.stop('stand');
                }
            });

            // End of the game handling
            collector.on('end', async (collected, reason) => {
                // Create disabled buttons to show the game is over
                const disabledRow = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        hitButton.setDisabled(true),
                        standButton.setDisabled(true)
                    );

                // TODO: Calculate hands to determine winner
                let finalEmbed = gameWindow(playerHand, dealerHand, true);

                if (reason === 'stand') {
                    finalEmbed.setDescription(`You stand with **${playerHand}**.`);
                } else if (reason === 'bust') {
                    finalEmbed.setDescription(`You busted with **${playerHand}**!`);
                } else if (reason === 'time') {
                    finalEmbed.setDescription('Game timed out.');
                }

                // Shows the final result and disabled buttons
                await response.edit({
                    embeds: [finalEmbed],
                    components: [disabledRow]
                });
            });

		// Error handling to show when the Blackjack command fails
        } catch (error) {
            console.error("Error with Blackjack collector:", error);
            await interaction.followUp({ 
                content: 'An error occurred while playing Blackjack.', 
                ephemeral: true 
            });
        }
    }
	}
}
