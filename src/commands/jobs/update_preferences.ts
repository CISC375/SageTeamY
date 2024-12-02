import { DB } from '@root/config';
import { Command } from '@root/src/lib/types/Command';
import { ActionRowBuilder, ApplicationCommandOptionData, ApplicationCommandOptionType,
	ChatInputCommandInteraction, InteractionResponse, ModalBuilder, ModalSubmitFields,
	TextInputBuilder, TextInputStyle } from 'discord.js';

// should be same questions as jobform.ts line 16
const questions = [
	['What city are you located in?', 'Are you looking for remote or in person?', 'Job, internship or both?', 'How far are you willing to travel?'],
	['Interest 1', 'Interest 2', 'Interest 3', 'Interest 4', 'Interest 5']
];

export default class extends Command {

	name = 'update_preferences'
	description = 'View and update your preferences for jobs to be used with the Job Alert System!';

	options: ApplicationCommandOptionData[] = [
		{
			name: 'qset',
			description: 'Which question set do you want to view and update(1 or 2)?',
			type: ApplicationCommandOptionType.Number,
			required: true,
			choices: [
				{ name: 'qset 1', value: 1 },
				{ name: 'qset 2', value: 2 }
			]
		}
	]

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const questionSet = interaction.options.getNumber('qset') - 1;

		// bad input handling
		if (questionSet !== 0 && questionSet !== 1) {
			interaction.reply({ content: 'Please enter either 1 or 2' });
			return;
		}
		// Checks if user has done the job form at least once
		const existingAnswers = await interaction.client.mongo.collection(DB.USERS).findOne({
			discordId: interaction.user.id,
			jobPreferences: { $exists: true }
		});

		// directs user to do /jobform first since they have no preferences to update
		if (!existingAnswers) {
			interaction.reply({
				content: 'No preferences found, enter preferences by using the command /jobform',
				ephemeral: true
			});
			return;
		}
		const currentAns = existingAnswers.jobPreferences?.answers;
		const askedQuestions = questions[questionSet];
		// if questions changed, making sure to update these titles to correctly describe question
		const quesChoices = questionSet === 0
			? ['city', 'workType', 'employmentType', 'travelDistance']
			: ['interest1', 'interest2', 'interest3', 'interest4', 'interest5'];

		const rows = askedQuestions.map((question) => {
			let value = '';
			if (currentAns) {
				value = currentAns[quesChoices[askedQuestions.indexOf(question)]] || '';
			}
			return this.getAnswerField(question, askedQuestions.indexOf(question), value);
		});

		// creates the modal that pops up when command is used, with title matching which questions set user is answering
		const modal = new ModalBuilder()
			.setCustomId(`updateModal${questionSet}`)
			.setTitle(`Update Job Preferences (${questionSet + 1} of 2)`);


		for (const row of rows) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			modal.addComponents(row);
		}

		await interaction.showModal(modal);

		// Answers are handled in src/pieces/commandManager.ts on line 149

		return;
	}


	getAnswer(fields: ModalSubmitFields, questionNum: number): string {
		return fields.getField(`question${questionNum + 1}`).value;
	}


	getAnswerField(question: string, questionNum: number, value: string): ActionRowBuilder {
		return new ActionRowBuilder({ components: [new TextInputBuilder()
			.setCustomId(`question${questionNum + 1}`)
			.setLabel(`${question}`)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder(`Current value: ${value || 'Not Set'}`)
			.setRequired(false)] });
	}

}
