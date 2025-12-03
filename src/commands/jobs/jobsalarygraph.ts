import { ADZUNA_APP_ID, ADZUNA_APP_KEY } from '@root/config';
import { Command } from '@root/src/lib/types/Command';
import axios from 'axios';
import { ApplicationCommandOptionData, ApplicationCommandOptionType, ChatInputCommandInteraction, InteractionResponse } from 'discord.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';

export default class extends Command {

	description = `View a histogram of how many jobs are available at different salary ranges.`;
	extendedHelp = `See how many jobs are available at different salaries`;
	options: ApplicationCommandOptionData[] = [
		{
			name: 'job',
			description: 'Input the job title you want salary data for',
			type: ApplicationCommandOptionType.String,
			required: true
		}
	];

	async run(interaction: ChatInputCommandInteraction): Promise<void | InteractionResponse<boolean>> {
		await interaction.deferReply(); // Defer the reply first

		const jobTitle = interaction.options.getString('job');
		const encodedJobTitle = encodeURIComponent(jobTitle); // Encode the job title for the URL

		const URL_BASE = `https://api.adzuna.com/v1/api/jobs/us/histogram?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&what=${encodedJobTitle}`;

		try {
			const response = await axios.get(URL_BASE);

			const data = Object.entries(response.data.histogram).map(([value, frequency]: [string, number]) => ({
				value,
				frequency
			}));

			const image = await generateHistogram(data, jobTitle);

			await interaction.followUp({ files: [{ attachment: image, name: 'histogram.png' }] }); // Send the file as a follow-up
		} catch (e) {
			console.error('Error fetching job salary data', e);
			await interaction.followUp({ content: 'There was an issue fetching the job salary data. Please try again later.' });
			return;
		}
	}

}


// Function to generate a histogram image
export async function generateHistogram(data: { value: string; frequency: number }[], jobTitle: string): Promise<Buffer> {
	// Extract labels (values) and data (frequencies) from the JSON object
	const labels = data.map(item => item.value);
	const frequencies = data.map(item => item.frequency);

	// Set up Chart.js configuration
	const width = 800; // Width of the chart
	const height = 600; // Height of the chart
	const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'white' });


	const configuration: ChartConfiguration<'line'> = {
		type: 'line',
		data: {
			labels: labels,
			datasets: [
				{
					label: `Salary Range of ${jobTitle}`,
					data: frequencies,
					backgroundColor: '#0096FF', // Color of points (if any)
					borderColor: 'black', // Color of the line
					borderWidth: 2, // Thickness of the line
					fill: true, // Ensures no area under the line is filled
					cubicInterpolationMode: 'default', // Smooth line
					tension: 0.4, // Smoothness of the line
					segment: {
						backgroundColor: (ctx) => {
							const colors = ['#C47AFF', '#7978FF', '#4649FF', '#1D1CE5'];
							return colors[ctx.p0DataIndex % colors.length]; // Cycle through colors based on data index
						}
					}
				}
			]
		},
		options: {
			scales: {
				x: {
					title: {
						display: true,
						text: 'Annual Salary (USD)'
					}
				},
				y: {
					title: {
						display: true,
						text: 'Job Count'
					}
				}
			}
		}
	};


	const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
	return imageBuffer;
}
