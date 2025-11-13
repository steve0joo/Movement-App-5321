import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { collectionGroup, getDocs, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { getBuilding } from '../services/buildingService';
import './PersonDetails.css';



const PersonDetails = () => {
 const navigate = useNavigate();
 const [formData, setFormData] = useState(null);        // Stores all the people's data
 const [loading, setLoading] = useState(true);          // Tracks if data is being loaded
 const [error, setError] = useState(null);              // Stores any error messages
 const [expandedPerson, setExpandedPerson] = useState(null);  // Tracks which parts are expanded
 const [expandedBlock, setExpandedBlock] = useState(null);    // Tracks which building is expanded
 const { currentUser } = useAuth(); //the current user


 useEffect(() => {
   let isCancelled = false;

   const fetchVisitData = async () => {
     if (isCancelled) return;

     try {
       console.log('Fetching visit data from buildings...');
       // Query all visits across all buildings using collectionGroup
       const visitsQuery = query(
         collectionGroup(db, 'visits'),
         orderBy('visitDate', 'desc')
       );
       const querySnapshot = await getDocs(visitsQuery);
       const visits = [];
       const buildingIds = new Set();

       querySnapshot.forEach((doc) => {
         const data = doc.data();
         // Extract building ID from the document reference path
         // Path format: buildings/{buildingId}/visits/{visitId}
         const buildingId = doc.ref.parent.parent?.id;

         if (data && buildingId) {
           buildingIds.add(buildingId);
           visits.push({
             id: doc.id,
             buildingId,
             ...data,
             // Normalize field names for display
             block: buildingId, // Use buildingId as block for grouping
             unit: data.unitNumber,
             notes: data.notes || '',
             date: data.visitDate,
           });
         }
       });

       // Fetch building names for all buildings
       console.log('Fetching building names for', buildingIds.size, 'buildings...', Array.from(buildingIds));
       const buildingNameMap = {};
       await Promise.all(
         Array.from(buildingIds).map(async (buildingId) => {
           try {
             const building = await getBuilding(buildingId);
             console.log(`Fetched building ${buildingId}:`, building);
             buildingNameMap[buildingId] = building?.name || `Building ${buildingId.substring(0, 8)}...`;
           } catch (error) {
             console.error(`Error fetching building ${buildingId}:`, error);
             buildingNameMap[buildingId] = `Building ${buildingId.substring(0, 8)}...`;
           }
         })
       );

       console.log('Building name map:', buildingNameMap);

       // Add building names to visits
       visits.forEach(visit => {
         visit.buildingName = buildingNameMap[visit.buildingId] || visit.buildingId;
       });

       console.log('Sample visit with building name:', visits[0]);

       if (!isCancelled) {
         console.log('Fetched', visits.length, 'visit records with building names');
         setFormData(visits);
         setLoading(false);
       }
     } catch (err) {
       if (!isCancelled) {
         console.error('Error fetching visit data:', err);
         setError(`Failed to load visit data: ${err.message}`);
         setLoading(false);
       }
     }
   };

   //if current user exists, fetch data
   if (currentUser) {
     fetchVisitData();
   } else {
     setLoading(false);
   }

   return () => {
     isCancelled = true;
   };
 }, [currentUser]);


 // If user is not logged in
 if (!currentUser) {
   return <div className="person-details-page">Please log in to view this content.</div>;
 }


 // Show loading
 if (loading) {
   return <div className="person-details-page"><div className="loading">Loading...</div></div>;
 }


 // Show error message if data fetch failed
 if (error) {
   return <div className="person-details-page"><div className="error">{error}</div></div>;
 }




 //group visits by their building ID
 const groupByBuilding = (data) => {
   if (!Array.isArray(data)) return {};
   return data.reduce((acc, visit) => {
     if (!visit) return acc;
     const buildingId = visit.buildingId || visit.block || 'Unassigned';
     if (!acc[buildingId]) {
       acc[buildingId] = [];
     }
     acc[buildingId].push(visit);
     return acc;
   }, {});
 };


 // Handles clicking on a building/block header
 const handleBlockClick = (block) => {
   setExpandedBlock(expandedBlock === block ? null : block);
   setExpandedPerson(null);  // Close any open visit details
 };


// Handles clicking on a visit to show/hide details
 const handlePersonClick = (visitId) => {
   setExpandedPerson(expandedPerson === visitId ? null : visitId);
 };


 // Main render of the component
 return (
   <div className="person-details-page">
     <div className="page-header">
       <button 
         type="button"
         onClick={() => navigate('/')} 
         className="back-button"
       >
         ← Back to Dashboard
       </button>
       <h1>Visit History by Building</h1>
     </div>
     {formData && formData.length > 0 ? (
       <div className="buildings-list">
         {Object.entries(groupByBuilding(formData))
           // Sort buildings numerically/alphabetically
           .sort(([a], [b]) => String(a || '').localeCompare(String(b || '')))
           .map(([buildingId, visits]) => (
             // Building Section: Contains header and collapsible content
             <div key={buildingId} className="building-section">
               <div
                 className={`building-header ${expandedBlock === buildingId ? 'expanded' : ''}`}
                 onClick={() => handleBlockClick(buildingId)}
               >
                 <h2>{visits[0]?.buildingName || `Building ${buildingId}`}</h2>
                 <span className="person-count">{visits.length} {visits.length === 1 ? 'visit' : 'visits'}</span>
                 <span className="expand-icon">{expandedBlock === buildingId ? '−' : '+'}</span>
               </div>
               {expandedBlock === buildingId && (
                 <div className="people-list">
                   {visits.filter(visit => visit).map((visit) => (
                     <div key={visit.id} className="person-section">
                       <div
                         className={`person-header ${expandedPerson === visit.id ? 'expanded' : ''}`}
                         onClick={() => handlePersonClick(visit.id)}
                       >
                         <h3>Unit {visit.unitNumber || visit.unit || 'N/A'}</h3>
                         <span className="expand-icon">{expandedPerson === visit.id ? '−' : '+'}</span>
                       </div>
                       {expandedPerson === visit.id && (
                         <div className="person-details">
                           <div className="details-grid">
                             {/* Visit Information */}
                             <div className="detail-item">
                               <label>Unit Number</label>
                               <span>{visit.unitNumber || visit.unit || 'N/A'}</span>
                             </div>
                             <div className="detail-item">
                               <label>Visit Date</label>
                               <span>
                                 {visit.visitDate?.toDate
                                   ? visit.visitDate.toDate().toLocaleDateString()
                                   : visit.date?.toDate
                                   ? visit.date.toDate().toLocaleDateString()
                                   : visit.visitDate
                                   ? new Date(visit.visitDate).toLocaleDateString()
                                   : visit.date
                                   ? new Date(visit.date).toLocaleDateString()
                                   : 'N/A'
                                 }
                               </span>
                             </div>
                             <div className="detail-item full-width">
                               <label>Notes</label>
                               <span className="notes-text">{visit.notes || 'No notes available'}</span>
                             </div>
                             {visit.photoUrls && visit.photoUrls.length > 0 && (
                               <div className="detail-item full-width">
                                 <label>Photos</label>
                                 <span>{visit.photoUrls.length} photo(s) attached</span>
                               </div>
                             )}
                           </div>
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               )}
             </div>
           ))}
       </div>
     ) : (
       <div className="empty-state">
         <p>No visit data available.</p>
         <button
           type="button"
           onClick={() => navigate('/visits/new')}
           className="collect-button"
         >
           Record a Visit
         </button>
       </div>
     )}
   </div>
 );
};


export default PersonDetails;


