/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Note: You will edit this file in the follow up codelab about the Cloud Functions for Firebase.

const functions = require('firebase-functions');
// Import and initialize the Firebase Admin SDK.
const admin = require('firebase-admin');
admin.initializeApp();

// Adds a message that welcomes new users into the chat.
exports.addWelcomeMessages = functions.auth.user().onCreate(async (user) => {
	console.log('A new user signed in for the first time.');
	const fullName = user.displayName || 'Anonymous';

	// Saves the new welcome message into the database
	// which then displays it in the FriendlyChat clients.
	await admin.firestore().collection('messages').add({
		name: 'Firebase Bot',
		profilePicUrl: '/images/firebase-logo.png', // Firebase logo
		text: `${fullName} signed in for the first time! Welcome!`,
		timestamp: admin.firestore.FieldValue.serverTimestamp(),
	});
	console.log('Welcome message written to database.');
});


// TODO(DEVELOPER): Write the blurOffensiveImages Function here.

// Sends a notifications to all users when a new message is posted.
exports.sendNotifications = functions.firestore.document('messages/{messageId}').onCreate(
	async (snapshot) => {
		// Notification details.
		const text = snapshot.data().text;
		const payload = {
			notification: {
				title: `${snapshot.data().name} posted ${text ? 'a message' : 'an image'}`,
				body: text ? (text.length <= 100 ? text : text.substring(0, 97) + '...') : '',
				icon: snapshot.data().profilePicUrl || '/images/profile_placeholder.png',
				click_action: `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
			}
		};

		// Get the list of device tokens.
		const allTokens = await admin.firestore().collection('fcmTokens').get();
		const tokens = [];
		allTokens.forEach((tokenDoc) => {
			tokens.push(tokenDoc.id);
		});

		if (tokens.length > 0) {
			// Send notifications to all tokens.
			const response = await admin.messaging().sendToDevice(tokens, payload);
			await cleanupTokens(response, tokens);
			console.log('Notifications have been sent and tokens cleaned up.');
		}
	});

// Cleans up the tokens that are no longer valid.
function cleanupTokens(response, tokens) {
	// For each notification we check if there was an error.
	const tokensDelete = [];
	response.results.forEach((result, index) => {
		const error = result.error;
		if (error) {
			console.error('Failure sending notification to', tokens[index], error);
			// Cleanup the tokens who are not registered anymore.
			if (error.code === 'messaging/invalid-registration-token' ||
				error.code === 'messaging/registration-token-not-registered') {
				const deleteTask = admin.firestore().collection('fcmTokens').doc(tokens[index]).delete();
				tokensDelete.push(deleteTask);
			}
		}
	});
	return Promise.all(tokensDelete);
}
