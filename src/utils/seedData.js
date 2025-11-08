/**
 * Example Seed Data for Firestore Collections
 * This file contains sample data structures for all collections in the Movement App
 *
 * To use this data:
 * 1. Import the functions from their respective services
 * 2. Call the seed functions below to populate your Firestore database
 * 3. Make sure you're logged in as a super_admin
 */

import { createTeam } from '../services/teamService.js';
import { createCommunity } from '../services/communityService.js';
import { createRoute } from '../services/routeService.js';
import { createBuilding } from '../services/buildingService.js';

/**
 * Example Teams Data
 * Teams are the top-level organizational unit (e.g., geographic locations)
 */
export const exampleTeams = [
  {
    name: 'Gwinnett Team',
  },
  {
    name: 'Atlanta Team',
  },
  {
    name: 'Nashville Team',
  },
];

/**
 * Example Communities Data
 * Communities belong to teams (e.g., apartment complexes, neighborhoods)
 */
export const exampleCommunities = [
  {
    name: 'Oak Ridge Apartments',
    teamId: 'TEAM_ID_1', // Replace with actual team ID after creating teams
  },
  {
    name: 'Waterford Complex',
    teamId: 'TEAM_ID_1',
  },
  {
    name: 'Brookhaven Neighborhood',
    teamId: 'TEAM_ID_2',
  },
  {
    name: 'Midtown Heights',
    teamId: 'TEAM_ID_2',
  },
];

/**
 * Example Routes Data
 * Routes belong to communities and can be assigned to route leaders
 */
export const exampleRoutes = [
  {
    name: 'Route A',
    communityId: 'COMMUNITY_ID_1', // Replace with actual community ID
    teamId: 'TEAM_ID_1',
    routeLeaderId: null, // Will be assigned later
  },
  {
    name: 'Route B',
    communityId: 'COMMUNITY_ID_1',
    teamId: 'TEAM_ID_1',
    routeLeaderId: null,
  },
  {
    name: 'North Route',
    communityId: 'COMMUNITY_ID_2',
    teamId: 'TEAM_ID_1',
    routeLeaderId: null,
  },
  {
    name: 'South Route',
    communityId: 'COMMUNITY_ID_2',
    teamId: 'TEAM_ID_1',
    routeLeaderId: null,
  },
];

/**
 * Example Buildings Data
 * Buildings belong to routes and contain units
 */
export const exampleBuildings = [
  {
    name: 'Building A',
    address: '123 Oak Ridge Dr',
    routeId: 'ROUTE_ID_1', // Replace with actual route ID
    communityId: 'COMMUNITY_ID_1',
    teamId: 'TEAM_ID_1',
    units: ['101', '102', '103', '201', '202', '203'],
  },
  {
    name: 'Building B',
    address: '125 Oak Ridge Dr',
    routeId: 'ROUTE_ID_1',
    communityId: 'COMMUNITY_ID_1',
    teamId: 'TEAM_ID_1',
    units: ['101', '102', '103', '104'],
  },
  {
    name: '456 Waterford Ln',
    address: '456 Waterford Ln',
    routeId: 'ROUTE_ID_2',
    communityId: 'COMMUNITY_ID_2',
    teamId: 'TEAM_ID_1',
    units: ['A', 'B', 'C'],
  },
];

/**
 * Example Users Data
 * Users have roles and are assigned to teams (and routes for route_leaders)
 */
export const exampleUsers = [
  {
    email: 'admin@movement.org',
    password: 'admin123',
    role: 'super_admin',
    displayName: 'Super Admin',
    teamId: null, // super_admin doesn't need a team
    routeId: null,
  },
  {
    email: 'gwinnett.admin@movement.org',
    password: 'gwinnett123',
    role: 'team_admin',
    displayName: 'Gwinnett Admin',
    teamId: 'TEAM_ID_1', // Replace with actual team ID
    routeId: null,
  },
  {
    email: 'john.leader@movement.org',
    password: 'leader123',
    role: 'route_leader',
    displayName: 'John Smith',
    teamId: 'TEAM_ID_1',
    routeId: 'ROUTE_ID_1', // Replace with actual route ID
  },
  {
    email: 'sarah.volunteer@movement.org',
    password: 'volunteer123',
    role: 'volunteer',
    displayName: 'Sarah Johnson',
    teamId: 'TEAM_ID_1',
    routeId: null,
  },
];

/**
 * Example Visits Data
 * Visits are stored as subcollections under buildings
 * These would be created using the buildingService.createVisit() function
 */
export const exampleVisits = [
  {
    buildingId: 'BUILDING_ID_1', // Replace with actual building ID
    visitData: {
      unitNumber: '101',
      notes: 'Delivered care package. Family was very grateful.',
      photoUrls: [],
      visitDate: new Date('2025-10-15'),
    },
    createdBy: 'USER_ID_1', // Replace with actual user ID
  },
  {
    buildingId: 'BUILDING_ID_1',
    visitData: {
      unitNumber: '102',
      notes: 'Follow-up visit. Discussed youth programs.',
      photoUrls: [],
      visitDate: new Date('2025-10-20'),
    },
    createdBy: 'USER_ID_1',
  },
];

/**
 * Example FollowUps Data
 * FollowUps track tasks that need to be completed
 */
export const exampleFollowUps = [
  {
    buildingId: 'BUILDING_ID_1', // Replace with actual building ID
    unitNumber: '103',
    teamId: 'TEAM_ID_1',
    routeId: 'ROUTE_ID_1',
    description: 'Schedule tutoring session for two children',
    status: 'pending',
    createdBy: 'USER_ID_1',
    dueDate: new Date('2025-11-01'),
  },
  {
    buildingId: 'BUILDING_ID_2',
    unitNumber: 'A',
    teamId: 'TEAM_ID_1',
    routeId: 'ROUTE_ID_2',
    description: 'Deliver winter clothing donation',
    status: 'pending',
    createdBy: 'USER_ID_2',
    dueDate: new Date('2025-11-05'),
  },
];

/**
 * Seed all data into Firestore
 *
 * WARNING: This will create new documents in your Firestore database
 * Make sure you're connected to the correct Firebase project
 *
 * @param {string} createdBy - User ID of the person running the seed (must be super_admin)
 * @returns {Promise<Object>} Object containing all created IDs
 */
export async function seedAllData(createdBy) {
  console.log('🌱 Starting database seed...');

  const createdIds = {
    teams: [],
    communities: [],
    routes: [],
    buildings: [],
    users: [],
  };

  try {
    // 1. Create Teams
    console.log('Creating teams...');
    for (const teamData of exampleTeams) {
      const team = await createTeam(teamData.name, createdBy);
      createdIds.teams.push(team.id);
      console.log(`✓ Created team: ${team.name} (${team.id})`);
    }

    // 2. Create Communities
    console.log('\nCreating communities...');
    const communityDataWithIds = [
      { name: 'Oak Ridge Apartments', teamId: createdIds.teams[0] },
      { name: 'Waterford Complex', teamId: createdIds.teams[0] },
      { name: 'Brookhaven Neighborhood', teamId: createdIds.teams[1] },
      { name: 'Midtown Heights', teamId: createdIds.teams[1] },
    ];

    for (const communityData of communityDataWithIds) {
      const community = await createCommunity(
        communityData.name,
        communityData.teamId,
        createdBy
      );
      createdIds.communities.push(community.id);
      console.log(`✓ Created community: ${community.name} (${community.id})`);
    }

    // 3. Create Routes
    console.log('\nCreating routes...');
    const routeDataWithIds = [
      { name: 'Route A', communityId: createdIds.communities[0], teamId: createdIds.teams[0] },
      { name: 'Route B', communityId: createdIds.communities[0], teamId: createdIds.teams[0] },
      { name: 'North Route', communityId: createdIds.communities[1], teamId: createdIds.teams[0] },
      { name: 'South Route', communityId: createdIds.communities[1], teamId: createdIds.teams[0] },
    ];

    for (const routeData of routeDataWithIds) {
      const route = await createRoute(
        routeData.name,
        routeData.communityId,
        routeData.teamId,
        createdBy,
        null // routeLeaderId
      );
      createdIds.routes.push(route.id);
      console.log(`✓ Created route: ${route.name} (${route.id})`);
    }

    console.log('\n✅ Database seed completed successfully!');
    console.log('\nCreated IDs:', JSON.stringify(createdIds, null, 2));

    return createdIds;
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

/**
 * Example of complete Firestore document structure with all fields
 */
export const firestoreDocumentExamples = {
  // Teams Collection Example
  team: {
    id: 'abc123xyz', // Auto-generated by Firestore
    name: 'Gwinnett Team',
    createdBy: 'user_id_123',
    createdAt: { seconds: 1698765432, nanoseconds: 0 }, // Firestore Timestamp
    isActive: true,
  },

  // Communities Collection Example
  community: {
    id: 'def456uvw',
    name: 'Oak Ridge Apartments',
    teamId: 'abc123xyz',
    createdBy: 'user_id_123',
    createdAt: { seconds: 1698765432, nanoseconds: 0 },
    isActive: true,
  },

  // Routes Collection Example
  route: {
    id: 'ghi789rst',
    name: 'Route A',
    communityId: 'def456uvw',
    teamId: 'abc123xyz',
    routeLeaderId: 'user_id_456', // Can be null
    createdBy: 'user_id_123',
    createdAt: { seconds: 1698765432, nanoseconds: 0 },
    isActive: true,
  },

  // Buildings Collection Example
  building: {
    id: 'jkl012opq',
    name: 'Building A',
    address: '123 Oak Ridge Dr',
    routeId: 'ghi789rst',
    communityId: 'def456uvw',
    teamId: 'abc123xyz',
    units: ['101', '102', '103', '201', '202', '203'],
    createdBy: 'user_id_456',
    createdAt: { seconds: 1698765432, nanoseconds: 0 },
    lastVisitDate: { seconds: 1698865432, nanoseconds: 0 }, // Updated when visits are created
    visitCount: 5, // Auto-incremented
    isActive: true,
  },

  // Visits Subcollection Example (under buildings/{buildingId}/visits/{visitId})
  visit: {
    id: 'mno345lmn',
    visitDate: { seconds: 1698865432, nanoseconds: 0 },
    unitNumber: '101',
    createdBy: 'user_id_456',
    createdAt: { seconds: 1698865432, nanoseconds: 0 },
    notes: 'Delivered care package. Family was very grateful.',
    photoUrls: [
      'https://firebasestorage.googleapis.com/.../photo1.jpg',
      'https://firebasestorage.googleapis.com/.../photo2.jpg',
    ],
  },

  // Users Collection Example
  user: {
    id: 'user_id_456', // Same as Firebase Auth UID
    email: 'john.leader@movement.org',
    role: 'route_leader', // One of: volunteer, route_leader, team_admin, super_admin
    teamId: 'abc123xyz', // Required for all except super_admin
    routeId: 'ghi789rst', // Required only for route_leader
    displayName: 'John Smith',
    isActive: true,
    createdAt: { seconds: 1698765432, nanoseconds: 0 },
  },

  // FollowUps Collection Example
  followUp: {
    id: 'pqr678stu',
    buildingId: 'jkl012opq',
    unitNumber: '103',
    teamId: 'abc123xyz',
    routeId: 'ghi789rst',
    description: 'Schedule tutoring session for two children',
    status: 'pending', // One of: pending, completed, cancelled
    createdBy: 'user_id_456',
    createdAt: { seconds: 1698765432, nanoseconds: 0 },
    dueDate: { seconds: 1699370232, nanoseconds: 0 },
    completedAt: null, // Timestamp when completed, or null
  },
};
