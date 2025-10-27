import {
	APP_ID,
	APP_KEY,
	BOT,
	CHANNELS,
	DB,
	EMAIL,
	MAP_KEY
} from '@root/config';
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Client,
	EmbedBuilder,
	TextChannel
} from 'discord.js';
import { schedule } from 'node-cron';
import { Reminder } from '@lib/types/Reminder';
import { Poll, PollResult } from '@lib/types/Poll';
import { MongoClient } from 'mongodb';
import fetchJobListings from '../lib/utils/jobUtils/Adzuna_job_search';
import { sendToFile } from '../lib/utils/generalUtils';
import { JobData } from '../lib/types/JobData';
import { Interest } from '../lib/types/Interest';
import { JobResult } from '../lib/types/JobResult';
import nodemailer from 'nodemailer';
import { JobPreferences } from '../lib/types/JobPreferences';
import axios from 'axios';
import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import { generateHistogram } from '../commands/jobs/histogram';

async function register(bot: Client): Promise<void> {
	schedule('0/30 * * * * *', () => {
		handleCron(bot).catch(async (error) => bot.emit('error', error));
	});
}

async function handleCron(bot: Client): Promise<void> {
	checkPolls(bot);
	checkReminders(bot);
}

async function checkPolls(bot: Client): Promise<void> {
	const polls: Poll[] = await bot.mongo
		.collection<Poll>(DB.POLLS)
		.find({ expires: { $lte: new Date() } })
		.toArray();
	const emotes = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
	polls.forEach(async (poll) => {
		const mdTimestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
		const resultMap = new Map<string, number>();
		let winners: PollResult[] = [];

		poll.results.forEach((res) => {
			resultMap.set(res.option, res.users.length);
			if (!winners[0]) {
				winners = [res];
				return;
			}
			if (winners[0] && res.users.length > winners[0].users.length) {
				winners = [res];
			} else if (res.users.length === winners[0].users.length) {
				winners.push(res);
			}
		});

		let winMessage: string;
		const winCount = winners[0].users.length;
		if (winCount === 0) {
			winMessage = 'It looks like no one has voted!';
		} else if (winners.length === 1) {
			winMessage = `**${
				winners[0].option
			}** has won the poll with ${winCount} vote${
				winCount === 1 ? '' : 's'
			}!`;
		} else {
			winMessage = `**${winners
				.slice(0, -1)
				.map((win) => win.option)
				.join(', ')} and ${
				winners.slice(-1)[0].option
			}** have won the poll with ${winCount} vote${
				winCount === 1 ? '' : 's'
			} each!`;
		}

		let choiceText = '';
		let count = 0;
		resultMap.forEach((value, key) => {
			choiceText += `${emotes[count++]} ${key}: ${value} vote${
				value === 1 ? '' : 's'
			}\n`;
		});

		const pollChannel = await bot.channels.fetch(poll.channel);
		if (pollChannel.type !== ChannelType.GuildText) {
			throw "something went wrong fetching the poll's channel";
		}

		const pollMsg = await pollChannel.messages.fetch(poll.message);
		const owner = await pollMsg.guild.members.fetch(poll.owner);
		const pollEmbed = new EmbedBuilder()
			.setTitle(poll.question)
			.setDescription(
				`This poll was created by ${owner.displayName} and ended **${mdTimestamp}**`
			)
			.addFields({
				name: `Winner${winners.length === 1 ? '' : 's'}`,
				value: winMessage
			})
			.addFields({ name: 'Choices', value: choiceText })
			.setColor('Random');

		pollMsg.edit({ embeds: [pollEmbed], components: [] });

		pollMsg.channel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle(poll.question)
					.setDescription(`${owner}'s poll has ended!`)
					.addFields({
						name: `Winner${winners.length === 1 ? '' : 's'}`,
						value: winMessage
					})
					.addFields({
						name: 'Original poll',
						value: `Click [here](${pollMsg.url}) to see the original poll.`
					})
					.setColor('Random')
			]
		});

		await bot.mongo.collection<Poll>(DB.POLLS).findOneAndDelete(poll);
	});
}

// eslint-disable-next-line no-warning-comments
// Retrieves job form data from the DB for a given user and builds the necessary payload for job search
async function getJobFormData(
	userID: string
): Promise<[JobData, Interest, JobResult[]]> {
	const client = await MongoClient.connect(DB.CONNECTION, {
		useUnifiedTopology: true
	});
	const db = client.db(BOT.NAME).collection(DB.USERS);

	// Attempt to find the user's job preferences by their Discord ID
	const jobformAnswers: JobPreferences | null = (
		await db.findOne({ discordId: userID })
	)?.jobPreferences;

	// If no job preferences exist, bail early with a meaningful error
	if (!jobformAnswers || !jobformAnswers.answers) {
		throw new Error(`No job preferences found for user ${userID}`);
	}

	const { answers } = jobformAnswers;

	// Build the main job search query payload from the user's saved answers
	const jobData: JobData = {
		city: answers.city,
		preference: answers.workType,
		jobType: answers.employmentType,
		distance: answers.travelDistance,
		filterBy: 'default'
	};

	// Build the interests section for filtering jobs further
	const interests: Interest = {
		interest1: answers.interest1,
		interest2: answers.interest2,
		interest3: answers.interest3,
		interest4: answers.interest4,
		interest5: answers.interest5
	};

	// Fetch jobs using Adzuna with the above criteria
	const APIResponse: JobResult[] = await fetchJobListings(jobData, interests);
	return [jobData, interests, APIResponse];
}

function formatCurrency(currency: number): string {
	return isNaN(currency)
		? 'N/A'
		: `${new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(Number(currency))}`;
}

function calculateDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const toRadians = (degrees: number) => degrees * (Math.PI / 180);

	// eslint-disable-next-line id-length
	const R = 3958.8; // Radius of the Earth in miles
	const dLat = toRadians(lat2 - lat1);
	const dLon = toRadians(lon2 - lon1);
	const a
		= (Math.sin(dLat / 2) * Math.sin(dLat / 2)) +
		(Math.cos(toRadians(lat1))
			* Math.cos(toRadians(lat2))
			* Math.sin(dLon / 2)
			* Math.sin(dLon / 2));
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance
		= (lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0) ? -1 : R * c;
	return distance;
}

async function queryCoordinates(
	location: string
): Promise<{ lat: number; lng: number }> {
	const preferredCity = encodeURIComponent(location);

	const baseURL = `https://maps.google.com/maps/api/geocode/json?address=${preferredCity}&components=country:US&key=${MAP_KEY}`;
	const response = await axios.get(baseURL);
	const coordinates: { lat: number; lng: number } = {
		lat: response.data.results[0].geometry.location.lat,
		lng: response.data.results[0].geometry.location.lng
	};

	return coordinates;
}

export function titleCase(jobTitle: string | undefined | null): string {
	if (!jobTitle) return ''; // fallback for null or undefined
	return jobTitle
		.toLowerCase()
		.replace(/[()]/g, '')
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

async function listJobs(
	jobForm: [JobData, Interest, JobResult[]],
	filterBy: string
): Promise<string> {
	// Conditionally sort jobs by salary if sortBy is 'salary'
	const cityCoordinates = await queryCoordinates(jobForm[0].city);

	if (filterBy === 'salary') {
		jobForm[2].sort((a, b) => {
			const avgA = (Number(a.salaryMax) + Number(a.salaryMin)) / 2;
			const avgB = (Number(b.salaryMax) + Number(b.salaryMin)) / 2;

			// Handle cases where salaryMax or salaryMin is "Not listed"
			if (isNaN(avgA)) return 1; // Treat jobs with no salary info as lowest
			if (isNaN(avgB)) return -1;

			return avgB - avgA; // Descending order
		});
	} else if (filterBy === 'alphabetical') {
		jobForm[2].sort((a, b) => a.title > b.title ? 1 : -1);
	} else if (filterBy === 'date') {
		jobForm[2].sort(
			(a, b) =>
				new Date(b.created).getTime() - new Date(a.created).getTime()
		);
	} else if (filterBy === 'distance') {
		// cityCoordinates = await this.queryCoordinates(jobForm[0].city);

		jobForm[2].sort((a, b) => {
			const distanceA = a.distance;
			const distanceB = b.distance;

			if (distanceA === -1) {
				return 1; // Treat jobs with no location as lowest
			}

			return distanceA - distanceB; // Might have to account for negative distances
		});
	}

	let jobList = '';
	for (let i = 0; i < jobForm[2].length; i++) {
		const avgSalary
			= (Number(jobForm[2][i].salaryMax) +
				Number(jobForm[2][i].salaryMin))
			/ 2;
		const formattedAvgSalary = formatCurrency(avgSalary);
		const formattedSalaryMax
			= formatCurrency(Number(jobForm[2][i].salaryMax)) !== 'N/A'
				? formatCurrency(Number(jobForm[2][i].salaryMax))
				: '';
		const formattedSalaryMin
			= formatCurrency(Number(jobForm[2][i].salaryMin)) !== 'N/A'
				? formatCurrency(Number(jobForm[2][i].salaryMin))
				: '';
		const jobDistance = calculateDistance(
			cityCoordinates.lat,
			cityCoordinates.lng,
			Number(jobForm[2][i].latitude),
			Number(jobForm[2][i].longitude)
		);
		const formattedDistance
			= jobDistance !== -1 ? `${jobDistance.toFixed(2)} miles` : 'N/A';

		const salaryDetails
			= formattedSalaryMin && formattedSalaryMax
				? `, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
				: formattedAvgSalary;

		jobList += `${i + 1}. **${jobForm[2][i].title}**
		  \t\t* **Salary Average:** ${formattedAvgSalary}${salaryDetails}
		  \t\t* **Location:** ${jobForm[2][i].location}
		  \t\t* **Date Posted:** ${new Date(
		jobForm[2][i].created
	).toDateString()} at ${new Date(
	jobForm[2][i].created
).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
		  \t\t* **Apply here:** [read more about the job and apply here](${
	jobForm[2][i].link
})
		  \t\t* **Distance:** ${formattedDistance}
		  ${i !== jobForm[2].length - 1 ? '\n' : ''}`;
	}

	return (
		jobList
		|| '### Unfortunately, there were no jobs found based on your interests :(. Consider updating your interests or waiting until something is found.'
	);
}

export async function jobMessage(
	reminder: Reminder | string,
	userID: string
): Promise<{
		message: string;
		pdfBuffer: Buffer;
		embed: EmbedBuilder;
		row: ActionRowBuilder<ButtonBuilder>;
		jobResults: JobResult[];
	}> {
	const jobFormData: [JobData, Interest, JobResult[]] = await getJobFormData(
		userID
	);
	let filterBy: string;
	if (
		typeof reminder === 'object'
		&& 'filterBy' in reminder
		&& reminder.filterBy
	) {
		filterBy = String(reminder.filterBy);
	} else if (typeof reminder === 'object') {
		filterBy = 'default';
	} else {
		filterBy
			= typeof reminder === 'string' && reminder ? reminder : 'default';
	}

	const cityCoordinates = await queryCoordinates(jobFormData[0].city);
	for (let i = 0; i < jobFormData[2].length; i++) {
		const job = jobFormData[2][i];
		const distance
			= (Math.round(
				calculateDistance(
					cityCoordinates.lat,
					cityCoordinates.lng,
					Number(job.latitude),
					Number(job.longitude)
				) + Number.EPSILON
			)
				* 100)
			/ 100; // Round to 2 decimal places
		jobFormData[2][i].distance = distance;
	}

	const jobResults: JobResult[] = await sortJobResults(jobFormData, filterBy);
	const { embed, row } = createJobEmbed(jobResults[0], 0, jobResults.length);

	const pdfBuffer = await generateJobPDF(jobFormData);

	const message = `## Hey <@${userID}>!
		## Here's your list of job/internship recommendations:
	Based on your interests in **${jobFormData[1].interest1}**, **${
	jobFormData[1].interest2
}**, \
	**${jobFormData[1].interest3}**, **${jobFormData[1].interest4}**, and **${
	jobFormData[1].interest5
}**, I've found these jobs you may find interesting. Please note that while you may get\
	job/internship recommendations from the same company,\
	their positions/details/applications/salary WILL be different and this is not a glitch/bug!
	Here's your personalized list:

		${await listJobs(jobFormData, filterBy)}
		---
		### **Disclaimer:**
		-# Please be aware that the job listings displayed are retrieved from a third-party API. \
		While we strive to provide accurate information, we cannot guarantee the legitimacy or security\
		of all postings. Exercise caution when sharing personal information, submitting resumes, or registering\
		on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
		some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.`;

	return { message, pdfBuffer, embed, row, jobResults };
}

export function stripMarkdown(message: string, owner: string): string {
	return (
		message
			.replace(
				new RegExp(
					`## Hey <@${owner}>!\\s*## Here's your list of job/internship recommendations:?`,
					'g'
				),
				''
			) // Remove specific header
			.replace(/\[read more about the job and apply here\]/g, '')
			.replace(/\((https?:\/\/[^\s)]+)\)/g, '$1')
			.replace(/\*\*([^*]+)\*\*/g, '$1')
			.replace(/##+\s*/g, '')
			// eslint-disable-next-line no-useless-escape
			.replace(/###|-\#\s*/g, '')
			.trim()
	);
}

export function headerMessage(owner: string, filterBy: string): string {
	return `## Hey <@${owner}>!
	### **__Please read this disclaimer before reading your list of jobs/internships__:**
-# Please be aware that the job listings displayed are retrieved from a third-party API. \
While we strive to provide accurate information, we cannot guarantee the legitimacy or security \
of all postings. Exercise caution when sharing personal information, submitting resumes, or registering \
on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.
## Here's your list of job/internship recommendations${
	filterBy && filterBy !== 'default'
		? ` (filtered based on ${
			filterBy === 'date' ? 'date posted' : filterBy
		}):`
		: ':'
}
	`;
}

// Function to send an email notification for a reminder
async function sendEmailNotification(reminder: Reminder): Promise<void> {
	// Skip if email notification isn't enabled for this reminder
	if (!reminder.emailNotification || !reminder.emailAddress) {
		return;
	}

	// Create Gmail transporter using credentials from config
	const mailer = nodemailer.createTransport({
		host: 'mail.udel.edu',
		port: 25
	});

	try {
		// Determine subject and content based on reminder type
		let subject: string;
		let htmlContent: string;

		const isJobReminder = reminder.content === 'Job Reminder';

		if (isJobReminder) {
			subject = `Job Alert from ${BOT.NAME}`;
			// For job reminders, we could create a simplified version of the job listing
			// This would need to be developed further to extract job data properly
			htmlContent = `
                <h2>Your Job Alert from ${BOT.NAME}</h2>
                <p>This is your scheduled job alert. New job opportunities matching your interests are available!</p>
                <p>Please check your Discord messages for the full list of job opportunities.</p>
                <p>Frequency: ${reminder.repeat}</p>
                <p>Filter: ${reminder.filterBy}</p>
                <hr>
                <p><em>This is an automated message from the ${BOT.NAME} Discord bot.</em></p>
            `;
		} else {
			subject = `Reminder from ${BOT.NAME}`;
			htmlContent = `
                <h2>Your Reminder from ${BOT.NAME}</h2>
                <p><strong>Reminder content:</strong> ${reminder.content}</p>
                <p><em>This is an automated message from the ${BOT.NAME} Discord bot.</em></p>
            `;
		}

		// Send the email
		await mailer.sendMail({
			from: EMAIL.SENDER,
			replyTo: EMAIL.REPLY_TO,
			to: reminder.emailAddress,
			subject: subject,
			html: htmlContent
		});

		console.log(
			`Email notification sent to ${reminder.emailAddress} for reminder: ${reminder.content}`
		);
	} catch (error) {
		console.error('Failed to send email notification:', error);
	}
}

async function checkReminders(bot: Client): Promise<void> {
	const reminders: Reminder[] = await bot.mongo
		.collection(DB.REMINDERS)
		.find({ expires: { $lte: new Date() } })
		.toArray();
	const pubChan = (await bot.channels.fetch(CHANNELS.SAGE)) as TextChannel;

	reminders.forEach(async (reminder) => {
		// Send email notification if enabled
		if (reminder.emailNotification && reminder.emailAddress) {
			await sendEmailNotification(reminder);
		}

		if (reminder.mode === 'public') {
			pubChan.send(
				`<@${reminder.owner}>, here's the reminder you asked for: **${reminder.content}**`
			);
		} else {
			bot.users
				.fetch(reminder.owner)
				.then(async (user) => {
					await jobMessage(reminder, user.id);
					// const { message } = result;
					const message = 'placeholder'; // Placeholder for the message variable
					// Is this needed?
					// const { pdfBuffer } = result;
					if (message.length < 2000) {
						user.send(message).catch((err) => {
							console.log('ERROR:', err);
							pubChan.send(
								`<@${reminder.owner}>, I tried to send you a DM about your private reminder but it looks like you have DMs closed. Please enable DMs in the future if
							you'd like to get private reminders.`
							);
						});
					} else {
						const attachments: AttachmentBuilder[] = [];
						attachments.push(
							await sendToFile(
								stripMarkdown(
									message.split('---')[0],
									reminder.owner
								),
								'txt',
								'list-of-jobs-internships',
								false
							)
						);
						user.send({
							content: headerMessage(
								reminder.owner,
								reminder.filterBy
							),
							files: attachments as AttachmentBuilder[]
						});
					}
				})
				.catch((error) => {
					console.log(
						'ERROR CALLED ----------------------------------------------------'
					);
					console.error(
						`Failed to fetch user with ID: ${reminder.owner}`,
						error
					);
				});
		}

		const newReminder: Reminder = {
			content: reminder.content,
			expires: new Date(reminder.expires),
			mode: reminder.mode,
			repeat: reminder.repeat,
			owner: reminder.owner,
			// Preserve email notification settings for repeated reminders
			emailNotification: reminder.emailNotification,
			emailAddress: reminder.emailAddress
		};

		if (reminder.repeat === 'daily') {
			newReminder.expires.setDate(reminder.expires.getDate() + 1);
			bot.mongo
				.collection(DB.REMINDERS)
				.findOneAndReplace(reminder, newReminder);
		} else if (reminder.repeat === 'weekly') {
			newReminder.expires.setDate(reminder.expires.getDate() + 7);
			bot.mongo
				.collection(DB.REMINDERS)
				.findOneAndReplace(reminder, newReminder);
		} else {
			bot.mongo.collection(DB.REMINDERS).findOneAndDelete(reminder);
		}
	});
}

export async function generateJobPDF(
	jobForm: [JobData, Interest, JobResult[]]
): Promise<Buffer> {
	// Create a new PDF document.

	// Seperate sorting in listjobs into its own function, call function here so sorting maintained

	const jobs = jobForm[2];

	const pdfDoc = await PDFDocument.create();
	let currentPage = pdfDoc.addPage();
	const { width, height } = currentPage.getSize();
	const margin = 40;
	let yPosition = height - margin - 50;
	const fontSize = 10;
	const titleFontSize = 30;
	const bulletPointIndent = 20;
	const subBulletPointIndent = 30; // Indentation for sub-bullet points

	// Embed a standard font.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
	const HelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const Helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

	// Draw the title.
	const lineHeight = 10; // Height of the line
	const lineWidth = (width - (margin * 2)) / 3;

	currentPage.drawRectangle({
		x: margin,
		y: yPosition + 50,
		width: lineWidth,
		height: lineHeight,
		color: rgb(135 / 255, 59 / 255, 29 / 255) // red color
	});

	// Draw the second color segment
	currentPage.drawRectangle({
		x: margin + lineWidth,
		y: yPosition + 50,
		width: lineWidth,
		height: lineHeight,
		color: rgb(237 / 255, 118 / 255, 71 / 255) // orangey color
	});

	// Draw the third color segment
	currentPage.drawRectangle({
		x: margin + (lineWidth * 2),
		y: yPosition + 50,
		width: lineWidth,
		height: lineHeight,
		color: rgb(13 / 255, 158 / 255, 198 / 255) // Blue color
	});

	yPosition -= 40; // Adjust spacing below the line

	currentPage.drawText('List of Jobs PDF', {
		x: margin,
		y: yPosition + 50,
		size: titleFontSize,
		font: HelveticaBold,

		color: rgb(114 / 255, 53 / 255, 9 / 255)
	});
	yPosition -= 40;

	currentPage.drawRectangle({
		x: margin,
		y: yPosition + 50,
		width: lineWidth / 2,
		height: lineHeight - 8,
		color: rgb(135 / 255, 59 / 255, 29 / 255) // red color
	});
	yPosition -= 10;

	// Loop through each job and add its details.
	for (let i = 0; i < jobs.length; i++) {
		const job = jobs[i];

		if (yPosition - (fontSize * 2) < margin) {
			currentPage = pdfDoc.addPage();
			yPosition = currentPage.getHeight() - margin - 20;
		}

		const maxWidth = width - (margin * 2); // Calculate available width
		const wrappedTitle = wrapText(
			`${i + 1}. ${job.title}`,
			HelveticaBold,
			fontSize + 10,
			maxWidth
		);

		for (const line of wrappedTitle) {
			// Check if there's enough space for the line
			if (yPosition - (fontSize * 2) < margin) {
				currentPage = pdfDoc.addPage();
				yPosition = currentPage.getHeight() - margin - 20;
			}

			currentPage.drawText(line, {
				x: margin,
				y: yPosition + 30,
				size: fontSize + 10,
				font: HelveticaBold,
				color: rgb(241 / 255, 113 / 255, 34 / 255)
			});

			yPosition -= 30; // Adjust spacing between lines
		}

		// Draw the bullet points for location, salary, and apply link.
		const bulletPoints = [
			{
				label: 'Location',
				value: `${job.location}, ${
					job.distance >= 0
						? `${job.distance} miles from ${titleCase(
							jobForm[0].city
						)}`
						: ''
				} `
			},
			{ label: 'Salary', value: formatSalaryforPDF(job) },
			{ label: 'Apply Here', value: job.link }
		];

		const jobTitle = encodeURIComponent(job.title);
		const URL_BASE = `https://api.adzuna.com/v1/api/jobs/us/histogram?app_id=${APP_ID}&app_key=${APP_KEY}&what=${jobTitle}`;

		const response = await axios.get(URL_BASE);
		const data = Object.entries(response.data.histogram).map(
			([value, frequency]: [string, number]) => ({
				value,
				frequency
			})
		);
		let noValues = true;

		for (const item of data) {
			if (item.frequency > 0) {
				noValues = false;
				break;
			}
		}

		const image = await generateHistogram(data, job.title);
		const imageBytes = await pdfDoc.embedPng(image);
		const imageDims = imageBytes.scale(0.2);

		for (const point of bulletPoints) {
			// Check if there's enough space on the page, and add a new page if needed.
			if (yPosition - (fontSize * 2) < margin) {
				currentPage = pdfDoc.addPage();
				yPosition = currentPage.getHeight() - margin - 20;
			}

			const maxLabelWidth
				= width - (margin * 2) - bulletPointIndent - subBulletPointIndent;
			const wrappedLabel = wrapText(
				`• ${point.label}`,
				HelveticaBold,
				fontSize + 5,
				maxLabelWidth
			);

			// Draw the wrapped label
			for (const line of wrappedLabel) {
				// Check if there's enough space for the line
				if (yPosition - (fontSize * 2) < margin) {
					currentPage = pdfDoc.addPage();
					yPosition = currentPage.getHeight() - margin - 20;
				}

				currentPage.drawText(line, {
					x: margin + bulletPointIndent,
					y: yPosition + 25,
					size: fontSize + 5,
					font: HelveticaBold,
					color: rgb(94 / 255, 74 / 255, 74 / 255)
				});

				if (point.label === 'Salary' && !noValues) {
					currentPage.drawImage(imageBytes, {
						// Change space check so it doesn't go off the page
						x: (currentPage.getWidth() / 2) - (imageDims.width / 2),
						y: yPosition - imageDims.height - 10,
						width: imageDims.width,
						height: imageDims.height
					});

					yPosition -= imageDims.height + 30; // Adjust spacing for the image
				}

				yPosition -= fontSize + 10; // Adjust spacing between lines
			}

			const combinedText = `•${point.value}`;
			const maxValueWidth
				= width - (margin * 2) - bulletPointIndent - subBulletPointIndent;
			const wrappedValue = wrapText(
				combinedText,
				HelveticaBold,
				fontSize + 4,
				maxValueWidth
			);

			for (const line of wrappedValue) {
				// Check if there's enough space for the line
				if (yPosition - (fontSize * 2) < margin) {
					currentPage = pdfDoc.addPage();
					yPosition = currentPage.getHeight() - margin - 20;
				}

				currentPage.drawText(line, {
					x: margin + bulletPointIndent + subBulletPointIndent,
					y: yPosition + 20,
					size: fontSize + 3,
					font: HelveticaBold,
					color: rgb(13 / 255, 158 / 255, 198 / 255)
				});

				yPosition -= fontSize + 5; // Adjust spacing between lines
			}

			yPosition -= 20; // Add extra spacing between items
		}

		yPosition -= 40; // Add extra spacing between jobs.
	}

	const pdfBytes = await pdfDoc.save();
	return Buffer.from(pdfBytes);
}

export function createJobEmbed(
	job: JobResult,
	index: number,
	totalJobs: number
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
	const embed = new EmbedBuilder()
		.setTitle(job.title)
		.setDescription(
			`**Location:** ${job.location}\n**Date Posted:** ${new Date(
				job.created
			).toDateString()}`
		)
		.addFields(
			{ name: 'Salary', value: formatSalaryforPDF(job), inline: true },
			{
				name: 'Apply Here',
				value: `[Click here](${job.link})`,
				inline: true
			}
		)
		.setFooter({ text: `Job ${index + 1} of ${totalJobs}` })
		.setColor('#0099ff');

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('previous')
			.setLabel('Previous')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(totalJobs === 1),
		new ButtonBuilder()
			.setCustomId('remove')
			.setLabel('Remove')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(totalJobs === 1),
		new ButtonBuilder()
			.setCustomId('next')
			.setLabel('Next')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(totalJobs === 1),
		// ----------------ADDED DOWNLOAD BUTTON-------------------
		new ButtonBuilder()
			.setCustomId('download')
			.setLabel('Download')
			.setStyle(ButtonStyle.Success)
	);
	return { embed, row };
}

function wrapText(
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
		const textWidth = font.widthOfTextAtSize(testLine, fontSize);

		if (textWidth <= maxWidth) {
			currentLine = testLine;
		} else {
			if (currentLine) {
				lines.push(currentLine);
			}
			currentLine = '';

			// Handle long words that exceed maxWidth
			let remainingWord = word;
			while (font.widthOfTextAtSize(remainingWord, fontSize) > maxWidth) {
				const splitIndex = Math.floor(
					(maxWidth
						/ font.widthOfTextAtSize(remainingWord, fontSize))
						* remainingWord.length
				);
				const chunk = remainingWord.slice(0, splitIndex);
				lines.push(chunk);
				remainingWord = remainingWord.slice(splitIndex);
			}
			currentLine = remainingWord;
		}
	}

	if (currentLine) {
		lines.push(currentLine);
	}

	return lines;
}

function formatSalaryforPDF(job: JobResult): string {
	const avgSalary = (Number(job.salaryMax) + Number(job.salaryMin)) / 2;
	const formattedAvgSalary = formatCurrency(avgSalary);
	const formattedSalaryMax
		= formatCurrency(Number(job.salaryMax)) !== 'N/A'
			? formatCurrency(Number(job.salaryMax))
			: '';
	const formattedSalaryMin
		= formatCurrency(Number(job.salaryMin)) !== 'N/A'
			? formatCurrency(Number(job.salaryMin))
			: '';

	return formattedSalaryMin && formattedSalaryMax
		? `Avg: ${formattedAvgSalary}, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
		: formattedAvgSalary;
}

async function sortJobResults(
	jobForm: [JobData, Interest, JobResult[]],
	filterBy: string
): Promise<JobResult[]> {
	if (filterBy === 'salary') {
		jobForm[2].sort((a, b) => {
			const avgA = (Number(a.salaryMax) + Number(a.salaryMin)) / 2;
			const avgB = (Number(b.salaryMax) + Number(b.salaryMin)) / 2;

			// Handle cases where salaryMax or salaryMin is "Not listed"
			if (isNaN(avgA)) return 1; // Treat jobs with no salary info as lowest
			if (isNaN(avgB)) return -1;

			return avgB - avgA; // Descending order
		});
	} else if (filterBy === 'alphabetical') {
		jobForm[2].sort((a, b) => a.title > b.title ? 1 : -1);
	} else if (filterBy === 'date') {
		jobForm[2].sort(
			(a, b) =>
				new Date(b.created).getTime() - new Date(a.created).getTime()
		);
	} else if (filterBy === 'distance') {
		jobForm[2].sort((a, b) => {
			const distanceA = a.distance;
			const distanceB = b.distance;

			if (distanceA === -1) {
				return 1; // Treat jobs with no location as lowest
			}

			return distanceA - distanceB; // Might have to account for negative distances
		});
	}

	return jobForm[2];
}

export default register;
