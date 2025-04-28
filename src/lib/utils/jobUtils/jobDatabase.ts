import { Collection, Db } from 'mongodb';
import { DB } from '@root/config';
import { validatePreferences } from './validatePreferences';
import { titleCase } from '@root/src/pieces/tasks';

// Class to store the info of the preferences the user previously put in to match to jobs in the database.
export class JobPreferenceAPI {

	private collection: Collection;
	mode: string;

	constructor(db: Db) {
		this.collection = db.collection(DB.USERS);
	}
	// Stores preferences into the database. Returns an error message if success is false.
	async storeFormResponses(userID: string, answers: string[]): Promise<{ success: boolean; message: string }> {
		// If user id does not exist, then nothing will be stored.
		if (!userID?.trim()) {
			return { success: false, message: 'Invalid User ID' };
		}
		try {
			const updateObject = {};
			// Checks if the answer provided is accuate.

			const [city, workType, employmentType, travelDistance] = answers[0].split(',').map((a) => titleCase(a.trim()));
			const [interest1, interest2, interest3, interest4, interest5] = answers[1].split(',').map((a) => titleCase(a.trim()));

			if (city) { updateObject['jobPreferences.answers.city'] = city; }
			if (workType) { updateObject['jobPreferences.answers.workType'] = workType; }
			if (employmentType) { updateObject['jobPreferences.answers.employmentType'] = employmentType; }
			if (travelDistance) { updateObject['jobPreferences.answers.travelDistance'] = travelDistance; }
			if (interest1) { updateObject['jobPreferences.answers.interest1'] = interest1; }
			if (interest2) { updateObject['jobPreferences.answers.interest2'] = interest2; }
			if (interest3) { updateObject['jobPreferences.answers.interest3'] = interest3; }
			if (interest4) { updateObject['jobPreferences.answers.interest4'] = interest4; }
			if (interest5) { updateObject['jobPreferences.answers.interest5'] = interest5; }


			// Updates preferences with new answers and the new date inputted if the answers length is greater than 0.
			if (Object.keys(updateObject).length === 0) return { success: false, message: 'No valid answers provided' };
			if (Object.keys(updateObject).length > 0) {
				await this.collection.updateOne(
					{ discordId: userID },
					{
						$set: {
							...updateObject,
							'jobPreferences.userID': userID,
							'jobPreferences.lastUpdated': new Date()
						}
					},
					{ upsert: true }
				);
			}
			return { success: true, message: 'Preferences stored successfully' };
		} catch (error) {
			console.error('Error storing job form responses', error);
			return { success: false, message: 'Failed to store preferences' };
		}
	}
	// Gets the preferences anwers from the database. Returns an error message if success is false.
	async getPreference(userID: string): Promise<{ success: boolean; data?; message: string }> {
		// If user id does not exist, then nothing will be stored.
		if (!userID?.trim()) {
			return { success: false, message: 'Invalid User ID' };
		}
		try {
			const user = await this.collection.findOne({ discordId: userID });
			return {
				success: true,
				data: user?.jobPreferences || null,
				message: user?.jobPreferences ? 'Preferences found' : 'No preferences found'
			};
		} catch (error) {
			console.error('Error getting job form responses', error);
			return { success: false, message: 'Failed to retrieve preferences' };
		}
	}
	// Deletes the preferences answers to an empty string. Returns an error message if success is false.
	async deletePreference(userID: string): Promise<{ success: boolean; message: string }> {
		// If user id does not exist, then nothing will be stored.
		if (!userID?.trim()) {
			return { success: false, message: 'Invalid User ID' };
		}
		try {
			const result = await this.collection.updateOne(
				{ discordId: userID },
				{ $unset: { jobPreferences: '' } }
			);
			return {
				success: result.modifiedCount > 0,
				message: result.modifiedCount > 0 ? 'Preferences deleted' : 'No preferences found'
			};
		} catch (error) {
			console.error('Error deleting job preference', error);
			return { success: false, message: 'Failed to delete preferences' };
		}
	}

}
