import axios from 'axios';
import { APP_ID, APP_KEY } from '@root/config';
import { JobData } from '../../types/JobData';
import { Interest } from '../../types/Interest';
import { JobListing } from '../../types/JobListing';
import { JobResult } from '../../types/JobResult';
import { AdzunaJobResponse } from '../../types/AdzunaJobResponse';

type JobCache = {
	[key: string]: JobListing[] | JobResult[];
};

const jobCache: JobCache = {};

export default async function fetchJobListings(jobData: JobData, interests?: Interest): Promise<JobResult[]> {
	// Safely encode jobData fields, falling back to defaults if they're missing
	const city = jobData.city ?? 'new york';
	const jobType = jobData.jobType ?? 'software';
	const distance = jobData.distance ?? '10';
	const filterBy = jobData.filterBy ?? 'default';

	const LOCATION = encodeURIComponent(city);
	const JOB_TYPE = encodeURIComponent(jobType);
	const DISTANCE_KM = Number(distance) * 1.609; // Convert miles to kilometers

	let whatInterests = '';
	if (interests) {
		// Turn user interests into dash-separated keywords
		const keys = Object.keys(interests);
		const lastKey = keys[keys.length - 1];
		const lastValue = interests[lastKey];

		for (const interest of keys) {
			const value = interests[interest];
			if (!value) {
				delete interests[interest];
				continue;
			}
			whatInterests += value.replace(/\s+/g, '-'); // Replace spaces with dashes
			if (value !== lastValue) whatInterests += ' ';
		}
	}
	whatInterests = encodeURIComponent(whatInterests);

	// Prevent crashes by defaulting undefined fields before toLowerCase()
	const cacheKey = `${jobType.toLowerCase()}-${city.toLowerCase()}-${whatInterests}`;
	if (jobCache[cacheKey]) {
		console.log('Fetching data from cache...');
		return jobCache[cacheKey] as JobResult[];
	}

	const staticInterest = 'Computer Science';
	// const staticWhatjob = 'Computer Science';

	const whatOrParams = [staticInterest];

	if (whatInterests) whatOrParams.push(whatInterests);

	const encodedWhatOr = encodeURIComponent(whatOrParams.join(','));
	const encodedWhatExclude = ['nurse', 'sales', 'teacher', 'pharmacist', 'butcher',
		'Media', 'Radiologist', 'Producer', 'examiner', 'Physician', 'Medical',
		'Cardiovascular', 'Purificiation', 'Residential'];
	const URL_BASE
	= `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${APP_ID}` +
	`&app_key=${APP_KEY}` +
	`&results_per_page=10` +
	`&what=${JOB_TYPE}` +
	`&what_or=${encodedWhatOr}` +
	`&what_exclude=${encodedWhatExclude}` +
	`&where=${LOCATION}` +
	`&distance=${Math.round(DISTANCE_KM)}`;

	try {
		// Append sorting only if it's not 'default'
		const url = filterBy !== 'default' ? `${URL_BASE}&sort_by=${filterBy}` : URL_BASE;

		const response = await axios.get(url);
		const jobResults: JobResult[] = response.data.results.map((job: AdzunaJobResponse) => ({
			company: job.company?.display_name || 'Not Provided',
			title: job.title,
			description: job.description || 'No description available',
			location: `${job.location?.display_name || 'Not Provided'} (${job.location?.area?.toString().replace(/,/g, ', ') || ''})`,
			created: job.created || 'Unknown',
			salaryMax: job.salary_max || 'Not listed',
			salaryMin: job.salary_min || 'Not listed',
			link: job.redirect_url || 'No link available',
			longitude: job.longitude || 0,
			latitude: job.latitude || 0
		}));

		return jobResults.sort();
	} catch (error) {
		console.error('API error:', error);
		throw error;
	}
}

