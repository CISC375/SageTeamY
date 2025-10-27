import { Command } from '@lib/types/Command';
import { ChatInputCommandInteraction,
	InteractionResponse,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ButtonInteraction,
	ComponentType }
	from 'discord.js';

/*
 TO DO:
 "Stand" button functionality
 "Rules" button functionality
 Dealer's hand logic
 Embed = Green on winning game
 Testing proper Ace functionality
 Implementing a winning game state
*/

// Introduces a helper "wait" function to make the bot wait X amount of milliseconds
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default class extends Command {

	description = 'Challenge Sage to a round of Black Jack!';
	extendedHelp = 'Get a higher score than Sage, but do not exceed 21!';

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		/* Deck consists of cards numbered 2-10.
		Repeated 10s account for Jack, Queen, King.
		11 resembles Ace*/
		const deck = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11, 1];
		let playerHand = 0;
		// Draws two random cards and adds them together from deck[]
		playerHand = deck[Math.floor(Math.random() * 13)] + deck[Math.floor(Math.random() * 13)];
		let dealerHand = deck[Math.floor(Math.random() * 13)];
		let drawnCard = 0;
		let dealerDrawnCard = 0;
		// GameStatus is the text appearing at the bottom of the Game Embed
		let gameStatus = "Click 'Hit' to draw or 'Stand' to pass";
		let gameOver = false;
		let win = false;

		// Accounts for two aces drawn at the start, going over 21
		if (playerHand === 22) {
			playerHand = 12;
		}

		// Creates game window/embed
		const createGameEmbed = (player: number, dealer: number, status: string) => {
			const embed = new EmbedBuilder()
				// Sets attributes for the game embed
				.setColor('#0099FF')
				.setTitle('Blackjack 🃏')
				.addFields(
					// Creates a field for the dealer's hand
					{ name: "Dealer's Hand", value: `**${dealer}**`, inline: true },
					// Creates a field for the player's hand
					{ name: `${interaction.user.username}'s Hand`, value: `**${player}**`, inline: true }
				)
				.setFooter({ text: status });

			// Color of the embed on the left changes depending on if it's game over or not
			if (gameOver && !win) {
				embed.setColor('Red');
			} else if (gameOver && win) {
				embed.setColor('Green');
			} else {
				embed.setColor('Blue');
			}
			return embed;
		};

		// Creates the buttons "Hit", "Stand", and "Rules"
		const hitButton = new ButtonBuilder()
			.setCustomId('blackjack_hit')
			.setLabel('Hit')
			.setStyle(ButtonStyle.Success); // .Success = Green button

		const standButton = new ButtonBuilder()
			.setCustomId('blackjack_stand')
			.setLabel('Stand')
			.setStyle(ButtonStyle.Danger); // .Danger = Red button

		const rulesButton = new ButtonBuilder()
			.setCustomId('blackjack_rules')
			.setLabel('Rules')
			.setStyle(ButtonStyle.Primary); // .Primary = Blue button

		// Puts the "Hit" and "Stand" buttons into a row
		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(hitButton, standButton, rulesButton);

		// Sage replies with the game's embed and buttons
		const response = await interaction.reply({
			embeds: [createGameEmbed(playerHand, dealerHand, gameStatus)],
			components: [row],
			withResponse: true
		});

		// Only the user who started the command can interact with the buttons
		const filter = (i: ButtonInteraction) => i.user.id === interaction.user.id;

		// "Listens" for clicks on the buttons
		const collector = response.resource.message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: filter,
			time: 60000 // You have 1 minute before the buttons are disabled
		});

		// Handles "hit" button click
		async function handleHit(i: ButtonInteraction) {
			// Acknowledges button click
			await i.deferUpdate();

			// Draws a card from 0-12, and uses the deck[] array to index for the card
			drawnCard = Math.floor(Math.random() * 13);

			// Shows user what card they drew
			if (drawnCard === 9) {
				gameStatus = `You drew a Jack (10).`;
			} else if (drawnCard === 10) {
				gameStatus = 'You drew a Queen (10).';
			} else if (drawnCard === 11) {
				gameStatus = 'You drew a King (10).';
			} else if (drawnCard !== 12) {
				gameStatus = `You drew a ${drawnCard + 2}.`;
			}

			// Handles if an Ace brings the player over a score of 21
			// Converts the Ace from 11 points to 1 point if so
			if (drawnCard === 12 && (playerHand + 11) > 21) {
				drawnCard = 13;
				gameStatus = 'You drew an Ace (1).';
			} else if (drawnCard === 12) {
				gameStatus = 'You drew an Ace (11).';
			}
			playerHand += deck[drawnCard];


			// Checks if the user "busts"
			if (playerHand > 21) {
				await wait(1500);
				gameStatus = 'Bust! You lose.';
				gameOver = true;
				collector.stop('bust');
				return;
			}

			// Updates game status
			await i.editReply({
				embeds: [createGameEmbed(playerHand, dealerHand, gameStatus)]
			});
		}

		// Handles "stand" button click
		async function handleStand(i: ButtonInteraction) {
			// Acknowledges the button has been clicked
			await i.deferUpdate();

			gameStatus = 'You stood your ground! Dealer\'s turn...';
			// Updates game status so you can't click buttons
			const standEmbed = createGameEmbed(playerHand, dealerHand, gameStatus);
			await response.resource.message.edit({
				embeds: [standEmbed],
				components: []
			});

			// Allows user to read game status before continuing
			await wait(1500);

			dealerDrawnCard = Math.floor(Math.random() * 13);

			// Shows user what card the dealer revealed
			if (dealerDrawnCard === 9) {
				gameStatus = `The dealer revealed a Jack (10).`;
			} else if (dealerDrawnCard === 10) {
				gameStatus = 'The dealer revealed a Queen (10).';
			} else if (dealerDrawnCard === 11) {
				gameStatus = 'The dealer revealed a King (10).';
			} else if (dealerDrawnCard !== 12) {
				gameStatus = `The dealer revealed a ${dealerDrawnCard + 2}.`;
			}

			// Handles if an Ace brings the dealer over a score of 21
			// Converts the Ace from 11 points to 1 point if so
			if (dealerDrawnCard === 12 && (dealerHand + 11) > 21) {
				drawnCard = 13;
				gameStatus = 'The dealer revealed an Ace (1).';
			} else if (dealerDrawnCard === 12) {
				gameStatus = 'The dealer revealed an Ace (11).';
			}
			dealerHand += deck[dealerDrawnCard];

			// Updates game status
			await i.editReply({
				embeds: [createGameEmbed(playerHand, dealerHand, gameStatus)]
			});

			// Keeps hitting if below 17 point threshold
			while (dealerHand <= 16 && dealerHand < playerHand) {
				// Allows user to read game status before continuing
				await wait(1500);
				dealerDrawnCard = Math.floor(Math.random() * 13);

				// Shows user what card the dealer drew
				if (dealerDrawnCard === 9) {
					gameStatus = `The dealer drew a Jack (10).`;
				} else if (dealerDrawnCard === 10) {
					gameStatus = 'The dealer drew a Queen (10).';
				} else if (dealerDrawnCard === 11) {
					gameStatus = 'The dealer drew a King (10).';
				} else if (dealerDrawnCard !== 12) {
					gameStatus = `The dealer drew a ${dealerDrawnCard + 2}.`;
				}

				// Converts an Ace from 11 points to 1 point if total points is over 21
				if (dealerDrawnCard === 12 && (dealerHand + 11) > 21) {
					drawnCard = 13;
					gameStatus = 'The dealer drew an Ace (1).';
				} else if (dealerDrawnCard === 12) {
					gameStatus = 'The dealer drew an Ace (11).';
				}
				dealerHand += deck[dealerDrawnCard];

				// Updates game status
				await i.editReply({
					embeds: [createGameEmbed(playerHand, dealerHand, gameStatus)]
				});
			}

			await wait(1500);

			// Tells user if the dealer stands or busts (if over 21 points)
			if (dealerHand <= 21) {
				gameStatus = 'The dealer stands.';
			} else {
				gameStatus = 'The dealer busts! You win!';
				win = true;
			}

			await i.editReply({
				embeds: [createGameEmbed(playerHand, dealerHand, gameStatus)]
			});

			await wait(1500);

			// Handles end of game condition of dealer standing or busting
			if (dealerHand <= 21) {
				collector.stop('stand');
			} else {
				collector.stop('dealer_bust');
			}
		}

		// Handles a "rules" button click
		async function handleRules(i: ButtonInteraction) {
			return i;
		}

		collector.on('collect', async (i) => {
			// Handles a "hit", "stand", or "rules" button click
			if (i.customId === 'blackjack_hit') {
				await handleHit(i);
			} else if (i.customId === 'blackjack_stand') {
				await handleStand(i);
			} else if (i.customId === 'blackjack_rules') {
				await handleRules(i);
			}
		});

		// Handles the end of the game
		collector.on('end', async (collected, reason) => {
			gameOver = true;

			// Tells user if the game timed out
			if (reason === 'time') {
				gameStatus = 'Game timed out.';
			} else if (reason === 'stand') {
				// Tells user who had the higher points
				if (dealerHand >= playerHand) {
					gameStatus = 'Dealer wins.';
				} else {
					gameStatus = 'You win!';
					win = true;
				}
			}

			// Updates game embed, and removes the buttons
			const finalEmbed = createGameEmbed(playerHand, dealerHand, gameStatus);
			await response.resource.message.edit({
				embeds: [finalEmbed],
				components: []
			});
		});
	}

}
