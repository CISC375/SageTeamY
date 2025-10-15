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
// General interview questions
const genQuestions: string[] = [
	'Tell me about a challenge you faced and how you overcame it.',
	'How do you handle working under pressure?',
	'Describe a mistake you’ve made and what you learned from it.',
	'Tell me about a time you set and achieved a meaningful goal.',
	'Describe a decision you made that others disagreed with. How did you handle it?',
	'Do you prefer working independently or in a team? Provide an example.',
	'What do you do when your opinion conflicts with someone else’s?',
	'Tell me about a time you motivated or supported a teammate.',
	'Describe a time you had to adapt quickly to change.',
	'How do you handle receiving constructive criticism?',
	'Tell me about a time when your initiative improved a process or outcome.',
	'Describe how you stay organized when balancing multiple tasks.',
	'Tell me about a time you showed leadership without having a formal title.'
];

// The following are all interview questions tailored to specific job roles
const softwareDevEng: string[] = [
	'Describe a particularly difficult technical problem you faced and how you resolved it.',
	'Tell me about a project where you had to quickly learn a new technology or framework.',
	'Describe how you handled finding a major bug right before a release.',
	'Give an example of a time you worked under a tight deadline. How did you manage your time?',
	'Tell me about a time you collaborated with others to solve a complex technical issue.',
	'Explain a time you had to simplify a complex idea for someone less technical.',
	'Describe a situation where you had to balance writing clean code with meeting performance requirements.',
	'Tell me about a time you disagreed with a teammate on implementation strategy. How was it resolved?',
	'What’s an example of when you went beyond the requirements to improve a product or feature?',
	'Describe a time you received critical feedback on your code. How did you respond?',
	'Tell me about a time you identified an inefficiency in a process and improved it.'
];

const sysAdmin: string[] = [
	'Tell me about a time you diagnosed and resolved a critical system outage.',
	'Describe a situation where you automated a repetitive task to improve efficiency.',
	'Give an example of when you had to communicate a technical issue to non-technical staff.',
	'Describe a time you handled multiple urgent tickets at once. How did you prioritize?',
	'Tell me about a mistake you made in system configuration and how you fixed it.',
	'Describe a time you improved system reliability or uptime.',
	'Tell me about a time you proposed or implemented a security enhancement.',
	'Describe a challenging incident involving data loss or backup recovery.',
	'How have you handled implementing a major infrastructure upgrade with minimal downtime?',
	'Give an example of how you’ve ensured compliance with IT security policies.'
];

const dataScientist: string[] = [
	'Tell me about a time you used data to influence a major decision.',
	'Describe a project where you had to work with incomplete or messy data.',
	'Explain a time when your analysis revealed something unexpected. What did you do?',
	'Tell me about a model or algorithm you developed and how you validated it.',
	'Describe how you balanced statistical accuracy with practical constraints.',
	'Give an example of explaining complex data insights to a non-technical audience.',
	'Describe how you’ve collaborated with engineers or business stakeholders to deliver a data product.',
	'Tell me about a time your findings were challenged. How did you defend or revise your analysis?',
	'Explain how you’ve ensured data quality or integrity in your work.',
	'Tell me about a time you had to choose between multiple analytical approaches.'
];

const uxuiDesigner: string[] = [
	'Describe a challenging design problem you solved and your approach.',
	'Tell me about a time you balanced user needs with business goals.',
	'Give an example of how you handled negative feedback on your design.',
	'Describe a time you had to advocate for the user experience in a product meeting.',
	'Tell me about a project where you collaborated closely with developers.',
	'Describe a time you adapted your design process to meet tight deadlines.',
	'Tell me about a design decision that didn’t go as planned. What did you learn?',
	'Give an example of how user testing influenced your final design.',
	'Tell me about a time you had to compromise on your design vision.',
	'Describe how you stay updated on design trends and tools.'
];

const projManager: string[] = [
	'Tell me about a project that went off track and how you got it back under control.',
	'Describe a time you had to manage conflicting stakeholder priorities.',
	'Give an example of how you motivated your team during a challenging phase.',
	'Tell me about a project where you had to deliver results under significant constraints.',
	'Describe how you handled a disagreement between team members.',
	'Explain how you adapted to a major scope change late in a project.',
	'Tell me about a time you had to make a difficult trade-off between quality, cost, and speed.',
	'Describe a situation where you had to communicate bad news to stakeholders.',
	'Tell me about a project you’re most proud of and why.',
	'Give an example of how you’ve built trust within a new or distributed team.'
];
