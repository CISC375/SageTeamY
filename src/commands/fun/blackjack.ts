import { Command } from '@lib/types/Command';
import { ChatInputCommandInteraction,
	InteractionResponse,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle }
	from 'discord.js';

export default class extends Command {

	description = 'Challenge Sage to a round of Black Jack!';
	extendedHelp = 'Get a higher score than Sage, but do not exceed 21!';

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		// Values implemented for testing
		// TO-DO: functionality of these variables
		const playerHand = 15;
		const dealerHand = 7;

		// Creates game window/embed
		const gameEmbed = new EmbedBuilder()
			// Sets attributes for the game embed
			.setColor('#0099FF')
			.setTitle('Blackjack 🃏')
			.addFields(
				// Creates a field for the dealer's hand
				{ name: "Dealer's Hand", value: `**${dealerHand}**`, inline: true },
				// Creates a field for the player's hand
				{ name: `${interaction.user.username}'s Hand`, value: `**${playerHand}**`, inline: true }
			);

		// Creates the buttons "Hit" and "Stand"
		const hitButton = new ButtonBuilder()
			.setCustomId('blackjack_hit')
			.setLabel('Hit')
			.setStyle(ButtonStyle.Success); // .Success = Green button

		const standButton = new ButtonBuilder()
			.setCustomId('blackjack_stand')
			.setLabel('Stand')
			.setStyle(ButtonStyle.Danger); // .Danger = Red button

		const rulesButton = new ButtonBuilder()
			.setCustomId('blackjack-rules')
			.setLabel('Rules')
			.setStyle(ButtonStyle.Primary) // .Primary = Blue button

		// Puts the "Hit" and "Stand" buttons into a row
		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(hitButton, standButton, rulesButton);

		// Sage replies with the game's embed and buttons
		await interaction.reply({
			embeds: [gameEmbed],
			components: [row]
		});
	}

}
