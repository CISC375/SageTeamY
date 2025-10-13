import {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	ChatInputCommandInteraction,
	InteractionResponse
} from 'discord.js';
import { Command } from '@lib/types/Command';
// import { setTimeout } from 'timers';

export default class extends Command {

	description = 'Practice answering common interview questions for a particular job role.';

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<InteractionResponse<boolean> | void> {
		const jobOptions = [
			{
				label: 'Software Engineer',
				value: 'software_engineer'
			},
			{
				label: 'Systems Administrator',
				value: 'systems_administrator'
			},
			{
				label: 'Data Scientist',
				value: 'data_scientist'
			},
			{
				label: 'UI/UX Designer',
				value: 'ui_ux_designer'
			},
			{
				label: 'IT Project Manager',
				value: 'it_project_manager'
			}
		];

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('interview_job_select')
			.setPlaceholder('Select a job role...')
			.addOptions(jobOptions);

		const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

		return interaction.reply({
			content:
				'Choose a  job role to practice interview questions:',
			components: [row]
		});
	}

}
