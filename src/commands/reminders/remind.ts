import { BOT, DB } from '@root/config';
import {
	ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	InteractionResponse
} from 'discord.js';
import { Reminder } from '@lib/types/Reminder';
import parse from 'parse-duration';
import { reminderTime } from '@root/src/lib/utils/generalUtils';
import { Command } from '@lib/types/Command';

export default class extends Command {

	description = `Have ${BOT.NAME} give you a reminder.`;
	extendedHelp = 'Reminders can be set to repeat daily or weekly.';
	options: ApplicationCommandOptionData[] = [
		{
			name: 'create',
			description: 'Create a reminder',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'content',
					description: 'What you\'d like to be reminded of',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'duration',
					description: 'When you\'d like to be reminded; enter units, e.g., "10 minutes", "2 hours", "1 day"',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'repeat',
					description: 'How often you want the reminder to repeat',
					choices: [
						{ name: 'Daily', value: 'daily' },
						{ name: 'Weekly', value: 'weekly' }
					],
					type: ApplicationCommandOptionType.String,
					required: false
				}
			]
		},
		{
			name: 'jobs',
			description: 'Create a job reminder',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'job-repeat',
					description: 'How often you want the reminder to repeat',
					choices: [
						{ name: 'Daily', value: 'daily' },
						{ name: 'Weekly', value: 'weekly' }
					],
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'filter-type',
					description: 'Select what you would like your job/internships filtered by',
					choices: [
						{ name: 'Relevance', value: 'relevance' },
						{ name: 'Salary', value: 'salary' },
						{ name: 'Date Posted', value: 'date' },
						{ name: 'Default', value: 'default' }
					],
					type: ApplicationCommandOptionType.String
				}
			]
		}
	];

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<InteractionResponse<boolean> | void> {
		const subcommand: string = interaction.options.getSubcommand();

		if (subcommand === 'jobs') {
			const jobReminderRepeat = interaction.options.getString('job-repeat') as
				| 'daily'
				| 'weekly' || null;

			const filterBy = interaction.options.getString('filter-type') as
				| 'relevance'
				| 'salary'
				| 'date'
				| 'default'
				|| 'default'; // fallback to default if null

			const jobReminder: Reminder = {
				owner: interaction.user.id,
				content: 'Job Reminder',
				mode: 'private',
				expires: new Date(),
				repeat: jobReminderRepeat,
				filterBy
			};

			const existing = await interaction.client.mongo
				.collection(DB.REMINDERS)
				.findOne({
					owner: interaction.user.id,
					content: 'Job Reminder',
					filterBy
				});

			if (existing) {
				return interaction.reply({
					content: `You already have a job reminder set with **${filterBy}** as the filter. Use /cancelreminder to remove it first.`,
					ephemeral: true
				});
			}

			await interaction.client.mongo
				.collection(DB.REMINDERS)
				.insertOne(jobReminder);

			console.log('[DEBUG] Inserted job reminder:', jobReminder);

			return interaction.reply({
				content: `I'll remind you about job offers ${jobReminderRepeat} at ${reminderTime(
					jobReminder
				)}.`,
				ephemeral: true
			});
		} else {
			const content = interaction.options.getString('content');
			const rawDuration = interaction.options.getString('duration');
			const duration = parse(rawDuration);
			const repeat = interaction.options.getString('repeat') as
				| 'daily'
				| 'weekly'
				|| null;

			if (!duration) {
				return interaction.reply({
					content: `**${rawDuration}** is not a valid duration. You can use words like hours, minutes, seconds, days, weeks, months, or years.`,
					ephemeral: true
				});
			}

			const reminder: Reminder = {
				owner: interaction.user.id,
				content,
				mode: 'public', // temporary
				expires: new Date(duration + Date.now()),
				repeat
			};

			await interaction.client.mongo
				.collection(DB.REMINDERS)
				.insertOne(reminder);

			return interaction.reply({
				content: `I'll remind you about that at ${reminderTime(reminder)}.`,
				ephemeral: true
			});
		}
	}

}
