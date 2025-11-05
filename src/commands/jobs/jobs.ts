/* eslint-disable no-mixed-operators */
/* eslint-disable no-control-regex */
import {
	ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	InteractionResponse,
	AttachmentBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ModalSubmitInteraction,
	User,
	TextChannel,
	DMChannel,
	NewsChannel,
	ThreadChannel
} from 'discord.js';
import fetchJobListings from '@root/src/lib/utils/jobUtils/Adzuna_job_search';
import { JobResult } from '@root/src/lib/types/JobResult';
import { Interest } from '@root/src/lib/types/Interest';
import { JobData } from '@root/src/lib/types/JobData';
import { Command } from '@lib/types/Command';
import { DB, BOT, GOOGLE_MAPS_KEY } from '@root/config';
import { MongoClient } from 'mongodb';
import axios from 'axios';
import { JobPreferences } from '@root/src/lib/types/JobPreferences';
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';

// Temporary storage for user job data
const userJobData = new Map<string, { jobs: JobResult[]; index: number }>();

export default class extends Command {

	description = `Get a listing of jobs based on your interests and preferences.`;
	extendedHelp = `This command will return a listing of jobs based on your interests and preferences.`;

	options: ApplicationCommandOptionData[] = [
		{
			name: 'filter',
			description: 'Filter options for job listings',
			type: ApplicationCommandOptionType.String,
			required: false,
			choices: [
				{ name: 'Date Posted: recent', value: 'date' },
				{ name: 'Salary: high-low average', value: 'salary' },
				{ name: 'Alphabetical: A-Z', value: 'alphabetical' },
				{ name: 'Distance: shortest-longest', value: 'distance' }
			]
		}
	];

	private sanitizeText(text: string): string {
		return text
			.replace(/[^\u0000-\u007F]/gu, '') // Remove non-ASCII (U+0000 through U+007F)
			.replace(/•/g, '*') // Replace bullet points
			.replace(/[“”]/g, '"') // Replace smart double quotes
			.replace(/[‘’]/g, "'") // Replace smart single quotes
			.replace(/\s+/g, ' ') // Collapse multiple whitespace
			.trim();
	}

	// Ensure variable names are clear
	private async generateJobPDF(jobs: JobResult[]): Promise<Buffer> {
		const pdfDoc = await PDFDocument.create();
		let currentPage = pdfDoc.addPage([600, 800]);
		const { width, height } = currentPage.getSize();
		const margin = 40;
		let yPosition = height - margin - 50;
		const fontSize = 10;
		const titleFontSize = 30;
		const bulletPointIndent = 20;
		const subBulletPointIndent = 30;

		const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
		const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

		// Draw title decoration
		const lineHeight = 10;
		const lineWidth = (width - margin * 2) / 3;

		currentPage.drawRectangle({
			x: margin,
			y: yPosition + 50,
			width: lineWidth,
			height: lineHeight,
			color: rgb(135 / 255, 59 / 255, 29 / 255)
		});

		currentPage.drawRectangle({
			x: margin + lineWidth,
			y: yPosition + 50,
			width: lineWidth,
			height: lineHeight,
			color: rgb(237 / 255, 118 / 255, 71 / 255)
		});

		currentPage.drawRectangle({
			x: margin + lineWidth * 2,
			y: yPosition + 50,
			width: lineWidth,
			height: lineHeight,
			color: rgb(13 / 255, 158 / 255, 198 / 255)
		});

		yPosition -= 40;

		// Draw title
		currentPage.drawText('Your Job Listings', {
			x: margin,
			y: yPosition + 50,
			size: titleFontSize,
			font: helveticaBold,
			color: rgb(114 / 255, 53 / 255, 9 / 255)
		});
		yPosition -= 40;

		// Draw separator line
		currentPage.drawRectangle({
			x: margin,
			y: yPosition + 50,
			width: lineWidth / 2,
			height: lineHeight - 8,
			color: rgb(135 / 255, 59 / 255, 29 / 255)
		});
		yPosition -= 10;

		// Add jobs to the PDF
		for (let i = 0; i < jobs.length; i++) {
			const job = jobs[i];
			const sanitizedJob = {
				title: this.sanitizeText(job.title),
				location: this.sanitizeText(job.location),
				salary: this.sanitizeText(this.formatSalaryforPDF(job)),
				link: job.link // URLs should be ASCII already
			};

			// Add new page if needed
			if (yPosition - fontSize * 2 < margin) {
				currentPage = pdfDoc.addPage([600, 800]);
				yPosition = currentPage.getHeight() - margin - 20;
			}

			// Add job title
			const titleLines = this.wrapText(
				`${i + 1}. ${sanitizedJob.title}`,
				helveticaBold,
				fontSize + 10,
				width - margin * 2
			);

			for (const line of titleLines) {
				if (yPosition - fontSize * 2 < margin) {
					currentPage = pdfDoc.addPage([600, 800]);
					yPosition = currentPage.getHeight() - margin - 20;
				}

				currentPage.drawText(line, {
					x: margin,
					y: yPosition + 30,
					size: fontSize + 10,
					font: helveticaBold,
					color: rgb(241 / 255, 113 / 255, 34 / 255)
				});
				yPosition -= 30;
			}

			// Add job details
			const details = [
				{ label: 'Location', value: sanitizedJob.location },
				{ label: 'Salary', value: sanitizedJob.salary },
				{ label: 'Apply Here', value: sanitizedJob.link }
			];

			for (const detail of details) {
				const labelLines = this.wrapText(
					`• ${detail.label}`,
					helveticaBold,
					fontSize + 5,
					width - margin * 2 - bulletPointIndent - subBulletPointIndent
				);

				for (const line of labelLines) {
					if (yPosition - fontSize * 2 < margin) {
						currentPage = pdfDoc.addPage([600, 800]);
						yPosition = currentPage.getHeight() - margin - 20;
					}

					currentPage.drawText(line, {
						x: margin + bulletPointIndent,
						y: yPosition + 25,
						size: fontSize + 5,
						font: helveticaBold,
						color: rgb(94 / 255, 74 / 255, 74 / 255)
					});
					yPosition -= fontSize + 10;
				}

				const valueLines = this.wrapText(
					`•${detail.value}`,
					helvetica,
					fontSize + 3,
					width - margin * 2 - bulletPointIndent - subBulletPointIndent
				);

				for (const line of valueLines) {
					if (yPosition - fontSize * 2 < margin) {
						currentPage = pdfDoc.addPage([600, 800]);
						yPosition = currentPage.getHeight() - margin - 20;
					}

					currentPage.drawText(line, {
						x: margin + bulletPointIndent + subBulletPointIndent,
						y: yPosition + 20,
						size: fontSize + 3,
						font: helvetica,
						color: rgb(13 / 255, 158 / 255, 198 / 255)
					});
					yPosition -= fontSize + 5;
				}

				yPosition -= 20;
			}

			yPosition -= 40;
		}

		const pdfBytes = await pdfDoc.save();
		return Buffer.from(pdfBytes);
	}

	private wrapText(
		text: string,
		font: PDFFont,
		fontSize: number,
		maxWidth: number
	): string[] {
		const words = text.split(' ');
		const lines: string[] = [];
		let currentLine = '';

		for (const word of words) {
			const testLine = currentLine ? `${currentLine} ${word}` : word;
			const testWidth = font.widthOfTextAtSize(testLine, fontSize);

			if (testWidth <= maxWidth) {
				currentLine = testLine;
			} else {
				if (currentLine) {
					lines.push(currentLine);
				}
				currentLine = word;
			}
		}

		if (currentLine) {
			lines.push(currentLine);
		}

		return lines;
	}

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<void | InteractionResponse<boolean>> {
		const userID = interaction.user.id;
		const filterBy = interaction.options.getString('filter') ?? 'salary';

		const client = await MongoClient.connect(DB.CONNECTION, {
			useUnifiedTopology: true
		});
		const db = client.db(BOT.NAME).collection(DB.USERS);
		const jobformAnswers: JobPreferences | null = (
			await db.findOne({ discordId: userID })
		)?.jobPreferences;

		if (!jobformAnswers) {
			await interaction.reply(
				"You haven't set up your job preferences yet. Please use `/jobform` first."
			);
			return;
		}

		const jobData: JobData = {
			city: jobformAnswers.answers.city,
			preference: jobformAnswers.answers.employmentType,
			jobType: jobformAnswers.answers.workType,
			distance: jobformAnswers.answers.travelDistance,
			filterBy: filterBy
		};

		const interests: Interest = {
			interest1: jobformAnswers.answers.interest1,
			interest2: jobformAnswers.answers.interest2,
			interest3: jobformAnswers.answers.interest3,
			interest4: jobformAnswers.answers.interest4,
			interest5: jobformAnswers.answers.interest5
		};

		const APIResponse: JobResult[] = await fetchJobListings(jobData, interests);

		if (APIResponse.length === 0) {
			await interaction.reply('No jobs found based on your interests.');
			return;
		}

		// Store job data for the user
		userJobData.set(userID, { jobs: APIResponse, index: 0 });

		// Create embed and buttons for the first job
		const { embed, row } = this.createJobEmbed(APIResponse[0], 0, APIResponse.length);
		await interaction.reply({ embeds: [embed], components: [row] });

		// Listen for button interactions
		const collector = interaction.channel?.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60000
		});

		collector?.on('collect', async (i) => {
			if (i.user.id !== userID) {
				await i.reply({ content: 'This is not your interaction!', ephemeral: true });
				return;
			}

			const userData = userJobData.get(userID);
			if (!userData) return;

			// eslint-disable-next-line prefer-const -- jobs is mutated via splice()
			let { jobs, index } = userData;

			switch (i.customId) {
				case 'previous':
					index = index > 0 ? index - 1 : jobs.length - 1;
					break;
				case 'next':
					index = index < jobs.length - 1 ? index + 1 : 0;
					break;
				case 'remove':
					jobs.splice(index, 1);
					if (jobs.length === 0) {
						await i.update({ content: 'No more jobs to display.', embeds: [], components: [] });
						userJobData.delete(userID);
						return;
					}
					index = index >= jobs.length ? 0 : index;
					break;
				case 'download':
					await i.deferReply({ ephemeral: true });
					try {
						const pdfBuffer = await this.generateJobPDF(jobs);
						const attachment = new AttachmentBuilder(pdfBuffer).setName('job_listings.pdf');
						await i.editReply({ content: 'Here are your job listings in PDF format:', files: [attachment] });
					} catch (error) {
						console.error('Error generating PDF:', error);
						await i.editReply({
							content: 'Failed to generate PDF. The job listings may contain unsupported characters.'
						});
					}
					break;
				case 'share': {
					// Show the modal
					await i.showModal(
						new ModalBuilder()
							.setCustomId('shareJobModal')
							.setTitle('Share Job')
							.addComponents(
								new ActionRowBuilder<TextInputBuilder>().addComponents(
									new TextInputBuilder()
										.setCustomId('recipient')
										.setLabel('Tag user or enter channel ID')
										.setStyle(TextInputStyle.Short)
										.setRequired(true)
								),
								new ActionRowBuilder<TextInputBuilder>().addComponents(
									new TextInputBuilder()
										.setCustomId('message')
										.setLabel('Add a message (optional)')
										.setStyle(TextInputStyle.Paragraph)
										.setRequired(false)
								)
							)
					);

					try {
						const modalInteraction = await i.awaitModalSubmit({
							filter: (mi) => mi.customId === 'shareJobModal' && mi.user.id === userID,
							time: 60_000
						});

						const userData2 = userJobData.get(userID);
						if (!userData2) {
							return modalInteraction.reply({
								content: '⚠️ Session expired—please restart your job search.',
								ephemeral: true
							});
						}

						await this.handleShareModal(modalInteraction, userData2.jobs[userData2.index]);
					} catch {
						// swallow timeout or other modal errors
					}

					return;
				}
			}

			// Update user data
			userJobData.set(userID, { jobs, index });

			// Update embed and buttons (rename on destructure to avoid shadowing)
			const { embed: newEmbed, row: newRow } = this.createJobEmbed(jobs[index], index, jobs.length);
			await i.update({ embeds: [newEmbed], components: [newRow] });
		});

		collector?.on('end', () => {
			userJobData.delete(userID);
		});
	}

	private async handleShareModal(modal: ModalSubmitInteraction, job: JobResult) {
		// Ack the modal immediately so Discord stops showing the spinner
		await modal.deferReply({ ephemeral: true });

		const raw = modal.fields.getTextInputValue('recipient').trim();
		let targetUser: User | null = null;
		// Only these channel classes have .send()
		let targetChannel: TextChannel | DMChannel | NewsChannel | ThreadChannel | null = null;

		// Try mention (<@...>), channel mention (<#...>), or raw ID
		const idMatch = raw.match(/^<@!?(\d+)>$|^<#(\d+)>$|^(\d{17,19})$/);
		if (idMatch) {
			const id = idMatch[1] || idMatch[2] || idMatch[3];

			// as a User
			targetUser = await modal.client.users.fetch(id).catch(() => null);

			// as a TextChannel/DMChannel/NewsChannel/ThreadChannel
			if (!targetUser && modal.guild) {
				const ch = modal.guild.channels.cache.get(id);
				if (ch instanceof TextChannel || ch instanceof DMChannel || ch instanceof NewsChannel || ch instanceof ThreadChannel) {
					targetChannel = ch;
				}
			}
		}

		// Fallback: look up username#discriminator in cache
		if (!targetUser && !targetChannel && raw.includes('#')) {
			const lowerTag = raw.toLowerCase();
			targetUser = modal.client.users.cache.find((user) => user.tag.toLowerCase() === lowerTag) || null;
		}

		if (!targetUser && !targetChannel) {
			return modal.editReply({
				content:
					'❌ Couldn’t resolve that as a user or channel. Please use a user mention (`<@ID>`), channel mention (`<#ID>`), raw ID, or a cached `username#1234`.'
			});
		}

		// Build the embed to share
		const shareEmbed = new EmbedBuilder()
			.setTitle(`Job Shared: ${job.title}`)
			.setDescription(`${modal.fields.getTextInputValue('message') || ''}\n\n**Shared by:** <@${modal.user.id}>`)
			.addFields(
				{ name: 'Location', value: job.location, inline: true },
				{ name: 'Posted', value: new Date(job.created).toDateString(), inline: true },
				{ name: 'Apply Here', value: `[Click here](${job.link})` }
			)
			.setColor('#4CAF50');

		try {
			if (targetUser) {
				await targetUser.send({ embeds: [shareEmbed] });
				await modal.editReply({ content: `✅ Job shared with <@${targetUser.id}>!` });
			} else if (targetChannel) {
				await targetChannel.send({ embeds: [shareEmbed] });
				await modal.editReply({ content: `✅ Job shared in <#${targetChannel.id}>!` });
			}
		} catch (err) {
			console.error('Failed to deliver shared job:', err);
			await modal.editReply({
				content: '⚠️ Couldn’t deliver the share—perhaps the user has DMs closed or I lack permission in that channel.'
			});
		}
	}

	createJobEmbed(
		job: JobResult,
		index: number,
		totalJobs: number
	): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
		const embed = new EmbedBuilder()
			.setTitle(job.title)
			.setDescription(`**Location:** ${job.location}\n**Date Posted:** ${new Date(job.created).toDateString()}`)
			.addFields(
				{ name: 'Salary', value: this.formatSalary(job), inline: true },
				{ name: 'Apply Here', value: `[Click here](${job.link})`, inline: true }
			)
			.setFooter({ text: `Job ${index + 1} of ${totalJobs}` })
			.setColor('#0099ff');

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId('previous').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(totalJobs === 1),
			new ButtonBuilder().setCustomId('remove').setLabel('Remove').setStyle(ButtonStyle.Danger).setDisabled(totalJobs === 1),
			new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(totalJobs === 1),
			new ButtonBuilder().setCustomId('download').setLabel('Download PDF').setStyle(ButtonStyle.Success).setEmoji('📄'),
			new ButtonBuilder().setCustomId('share').setLabel('Share').setStyle(ButtonStyle.Secondary).setEmoji('↗️')
		);

		return { embed, row };
	}

	// ... (keep all your existing helper methods below)
	formatSalary(job: JobResult): string {
		const avgSalary = (Number(job.salaryMax) + Number(job.salaryMin)) / 2;
		const formattedAvgSalary = this.formatCurrency(avgSalary);
		const formattedSalaryMax
			= this.formatCurrency(Number(job.salaryMax)) !== 'N/A' ? this.formatCurrency(Number(job.salaryMax)) : '';
		const formattedSalaryMin
			= this.formatCurrency(Number(job.salaryMin)) !== 'N/A' ? this.formatCurrency(Number(job.salaryMin)) : '';

		return formattedSalaryMin && formattedSalaryMax
			? `Avg: ${formattedAvgSalary}\nMin: ${formattedSalaryMin}\nMax: ${formattedSalaryMax}`
			: formattedAvgSalary;
	}

	formatSalaryforPDF(job: JobResult): string {
		const avgSalary = (Number(job.salaryMax) + Number(job.salaryMin)) / 2;
		const formattedAvgSalary = this.formatCurrency(avgSalary);
		const formattedSalaryMax
			= this.formatCurrency(Number(job.salaryMax)) !== 'N/A' ? this.formatCurrency(Number(job.salaryMax)) : '';
		const formattedSalaryMin
			= this.formatCurrency(Number(job.salaryMin)) !== 'N/A' ? this.formatCurrency(Number(job.salaryMin)) : '';

		return formattedSalaryMin && formattedSalaryMax
			? `Avg: ${formattedAvgSalary}, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
			: formattedAvgSalary;
	}

	formatCurrency(currency: number): string {
		return isNaN(currency)
			? 'N/A'
			: `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(currency))}`;
	}

	stripMarkdown(message: string, owner: string): string {
		return message
			.replace(
				new RegExp(`## Hey <@${owner}>!\\s*## Here's your list of job/internship recommendations:?`, 'g'),
				''
			)
			.replace(/\[read more about the job and apply here\]/g, '')
			.replace(/\((https?:\/\/[^\s)]+)\)/g, '$1')
			.replace(/\*\*([^*]+)\*\*/g, '$1')
			.replace(/##+\s*/g, '')
			.replace(/###|-#\s*/g, '') // remove unnecessary escape: \#
			.trim();
	}

	calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const toRadians = (degrees: number) => degrees * (Math.PI / 180);
		const Radius = 3958.8; // Radius of the Earth in miles
		const dLat = toRadians(lat2 - lat1);
		const dLon = toRadians(lon2 - lon1);
		const a
			= Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const distance = (lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0) ? -1 : Radius * c;
		return distance;
	}

	async queryCoordinates(location: string): Promise<{ lat: number; lng: number }> {
		const preferredCity = encodeURIComponent(location);
		const baseURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${preferredCity}&components=country:US&key=${GOOGLE_MAPS_KEY}`;
		const response = await axios.get(baseURL);
		return {
			lat: response.data.results[0].geometry.location.lat,
			lng: response.data.results[0].geometry.location.lng
		};
	}

}
