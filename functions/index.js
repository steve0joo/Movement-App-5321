/**
 * Firebase Cloud Function: Delete User
 *
 * Purpose: Delete both Firebase Auth account & Firestore profile
 *
 * Security: Only callable by super_admin or team_admin users
 *
 * Usage from client:
 *   const deleteUser = httpsCallable(functions, 'deleteUser');
 *   await deleteUser({ userId: 'user-id-to-delete' });
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.deleteUser = functions.https.onCall(async (data, context) => {
  // 1. Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to delete users'
    );
  }

  const callerId = context.auth.uid;
  const targetUserId = data.userId;

  if (!targetUserId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'userId is required'
    );
  }

  try {
    // 2. Get caller's profile to check permissions
    const callerDoc = await admin
      .firestore()
      .collection('users')
      .doc(callerId)
      .get();

    if (!callerDoc.exists) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Caller profile not found'
      );
    }

    const callerData = callerDoc.data();
    const callerRole = callerData.role;
    const callerTeamId = callerData.teamId;

    // 3. Get target user's profile
    const targetDoc = await admin
      .firestore()
      .collection('users')
      .doc(targetUserId)
      .get();

    if (!targetDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found');
    }

    const targetData = targetDoc.data();
    const targetRole = targetData.role;
    const targetTeamId = targetData.teamId;

    // 4. Check permissions
    const isSuperAdmin = callerRole === 'super_admin';
    const isTeamAdmin = callerRole === 'team_admin';

    if (!isSuperAdmin && !isTeamAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only super_admin or team_admin can delete users'
      );
    }

    // Team admins can only delete users in their team (and not super_admins)
    if (isTeamAdmin && !isSuperAdmin) {
      if (targetTeamId !== callerTeamId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Team admins can only delete users in their team'
        );
      }

      if (targetRole === 'super_admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Team admins cannot delete super_admins'
        );
      }
    }

    // Prevent self-deletion
    if (callerId === targetUserId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Cannot delete your own account'
      );
    }

    // 5. Delete Firebase Auth account
    await admin.auth().deleteUser(targetUserId);
    console.log(`Deleted Firebase Auth account: ${targetUserId}`);

    // 6. Delete Firestore profile
    await admin.firestore().collection('users').doc(targetUserId).delete();
    console.log(`Deleted Firestore profile: ${targetUserId}`);

    return {
      success: true,
      message: 'User deleted successfully',
      deletedUserId: targetUserId,
    };
  } catch (error) {
    console.error('Error deleting user:', error);

    // Re-throw HttpsErrors
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // Wrap other errors
    throw new functions.https.HttpsError('internal', error.message);
  }
});
