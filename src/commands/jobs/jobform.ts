import { Command } from '@root/src/lib/types/Command';
import { ApplicationCommandOptionData,
	ChatInputCommandInteraction,
	DMChannel,
	InteractionResponse,
	MessageFlags } from 'discord.js';
import { validatePreferences } from '../../lib/utils/jobUtils/validatePreferences';
import { JobPreferenceAPI } from '@root/src/lib/utils/jobUtils/jobDatabase';

// prettier-ignore
// Questions users will be asked to input into the API
const questions = [
	[
		'What city do you want to be located?',
		'What type of job would you like?',
		'Full time, Part time, and/or Internship?',
		'How far are you willing to travel? (in miles)',
		'What are your salary expectations?'
	],
	[
		'Interest 1',
		'Interest 2',
		'Interest 3',
		'Interest 4',
		'Interest 5'
	],
	[
		'Strength 1',
		'Strength 2',
		'Strength 3',
		'Goal 1',
		'Goal 2'
	]
];

// prettier-ignore
export default class extends Command {

	name = 'jobform';
	description = 'Starts a job preferences form via direct message.';

	// Gives option to command to choose what question set user is answering.
	options: ApplicationCommandOptionData[] = [];

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const dm = await interaction.user.createDM();
		await interaction.reply({
			content: 'I’ve sent you a DM with the job form questions.',
			flags: MessageFlags.Ephemeral
		});
		this.collectAnswers(dm, interaction.user.id, interaction);
	}

	private async collectAnswers(channel: DMChannel, userId: string, interaction: ChatInputCommandInteraction): Promise<void> {
		const answers: string[] = [];
		const splitAnswers: string[] = [];
		let current = 0;

		await channel.send(
			'Welcome to the job form!\n' +
      'Type **skip** to skip a question, **back** to return to the previous one.'
		);

		const ask = () => {
			channel.send(`**Question ${current + 1}/${questions.length}:** ${questions[current]}`);
		};

		const collector = channel.createMessageCollector({
			filter: (m) => m.author.id === userId,
			time: 5 * 60 * 1000 // 5 minutes
		});

		collector.on('collect', async msg => {
			const content = msg.content.trim();

			if (content.toLowerCase() === 'skip') {
				answers[current] = '';
			} else if (content.toLowerCase() === 'back') {
				if (current > 0) current--;
				return ask();
			} else {
				answers[current] = content;
				// Validate formatting immediately
				for (let i = 0; i < questions.length; i++) {
					if (answers[i]) {
						const newAnswers = answers[i].split(',').map((a) => a.trim());
						splitAnswers.push(...newAnswers);
					}


					/* const { isValid, errors } = validatePreferences(splitAnswers, 0, true);
					if (!isValid) {
						// Show errors and re-ask same question
						await channel.send(`**Formatting error:**\n${errors.join('\n')}`);
						answers[current] = '';
						return ask();
					} */
				}
			}

			// Move on or finish
			if (current < questions.length - 1) {
				current++;
				ask();
			} else {
				collector.stop('completed');
			}
		});

		collector.on('end', async (_collected, reason) => {
			if (reason !== 'completed') {
				await channel.send('Form timed out. Please run `/jobform` again to restart.');
				return;
			}

			// Final validation
			const { isValid, errors } = validatePreferences(splitAnswers, 0, true);
			if (!isValid) {
				await channel.send(`Form validation failed:\n${errors.join('\n')}`);
				return;
			}

			// Persist into Mongo
			const jobPreferenceAPI = new JobPreferenceAPI(interaction.client.mongo);
			await jobPreferenceAPI.storeFormResponses(userId, answers);

			await channel.send(
				`${`✅ Preferences saved! `}\n` +
		`You can now use the /jobs command to find job listings based on your preferences.`
			);
		});

		// Kick off the first question
		ask();
	}

}

