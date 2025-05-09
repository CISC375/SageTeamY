import { BOT, DB } from '@root/config';
import {
	ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	InteractionResponse
} from 'discord.js';
import { Command } from '@lib/types/Command';
import { checkJobReminder } from '@root/src/lib/utils/generalUtils';

export default class extends Command {

	description = `Have ${BOT.NAME} update what you'd like your job/internship results to be filtered by.`;
	options: ApplicationCommandOptionData[] = [
		{
			name: '-',
			description: 'Update job/internship filter',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'filter-type',
					description: 'Select an option',
					choices: [
						{ name: 'Relevance', value: 'relevance' },
						{ name: 'Salary', value: 'salary' },
						{ name: 'Date Posted', value: 'date' },
						{ name: 'Default', value: 'default' }
					],
					type: ApplicationCommandOptionType.String,
					required: true
				}
			]
		}
	];

	async updateFilter(interaction: ChatInputCommandInteraction, filter:string):Promise<void> {
		try {
			await interaction.client.mongo.collection(DB.REMINDERS).update(
				{ owner: interaction.user.id },
				{ $set: { filterBy: filter } }
			);
		} catch (error) {
			console.error('Failed to update filter:', error);
			interaction.reply('There was an error updating your filter preference');
		}
	}

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<InteractionResponse<boolean> | void> {
		const filterBy = interaction.options.getString('filter-type') as 'relevance' | 'salary' | 'date' | 'default';

		// Check if user already has a job reminder with that filter
		if (!await checkJobReminder(interaction, filterBy)) {
			await interaction.reply({
				content: 'Please make sure you have a job reminder with that filter already set. To do so, run `/remind jobs` first.',
				ephemeral: true
			});
		} else {
			await this.updateFilter(interaction, filterBy);
			await interaction.reply({
				content: `Your job/internship filter has been updated to **${filterBy}** successfully!`,
				ephemeral: true
			});
		}
	}

}
