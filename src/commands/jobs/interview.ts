import {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	ChatInputCommandInteraction,
	InteractionResponse,
	StringSelectMenuInteraction
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

		await interaction.reply({
			content:
				'Choose a job role to practice interview questions:',
			components: [row]
		});

		return;
	}

}

export async function handleInterviewOptionSelect(i: StringSelectMenuInteraction): Promise<void> {
	try {
		await i.user.send('Here is where the interview will take place.');
		await i.reply({ content: 'Check your DMs for the interview', ephemeral: true });
	} catch (err) {
		await i.reply({ content: "I couldn't DM you. Please check your privacy settings.", ephemeral: true });
	}
}
