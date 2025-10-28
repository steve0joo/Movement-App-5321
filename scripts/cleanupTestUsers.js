/**
 * Cleanup Script: Delete All Test Users
 *
 * This script deletes all users from Firebase Auth and Firestore.
 * USE WITH CAUTION - This is irreversible!
 *
 * Usage:
 *   node scripts/cleanupTestUsers.js
 */

const admin = require('firebase-admin');

// OPTION 1: Use service account key
// const serviceAccount = require('../serviceAccountKey.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// OPTION 2: For emulator testing
admin.initializeApp({
  projectId: 'movement-app-5321'
});

const auth = admin.auth();
const db = admin.firestore();

async function deleteAllUsers() {
  console.log('🧹 Starting user cleanup...\n');

  try {
    // Step 1: List all Auth users
    console.log('📋 Fetching all users from Firebase Auth...');
    const listUsersResult = await auth.listUsers();
    const authUsers = listUsersResult.users;
    console.log(`Found ${authUsers.length} users in Firebase Auth\n`);

    // Step 2: Delete each user
    let deletedCount = 0;
    let errorCount = 0;

    for (const user of authUsers) {
      console.log(`Deleting: ${user.email || user.uid}`);

      try {
        // Delete from Auth
        await auth.deleteUser(user.uid);

        // Delete from Firestore
        await db.collection('users').doc(user.uid).delete();

        deletedCount++;
        console.log(`  ✅ Deleted`);
      } catch (error) {
        errorCount++;
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Cleanup Summary');
    console.log('='.repeat(50));
    console.log(`Total users found:  ${authUsers.length}`);
    console.log(`Successfully deleted: ${deletedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('='.repeat(50));

    if (deletedCount > 0) {
      console.log('\n✅ Cleanup completed! You can now create fresh test users.\n');
    }

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    throw error;
  }
}

// Confirmation prompt
console.log('⚠️  WARNING: This will delete ALL users from Firebase Auth and Firestore!');
console.log('This action cannot be undone.\n');

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('Type "DELETE ALL" to confirm: ', (answer) => {
  if (answer === 'DELETE ALL') {
    deleteAllUsers()
      .then(() => {
        readline.close();
        process.exit(0);
      })
      .catch((error) => {
        console.error('Fatal error:', error);
        readline.close();
        process.exit(1);
      });
  } else {
    console.log('\n❌ Cancelled. No users were deleted.');
    readline.close();
    process.exit(0);
  }
});
