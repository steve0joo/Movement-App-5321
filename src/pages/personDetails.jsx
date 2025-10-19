import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
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
   
   const fetchFormData = async () => {
     if (isCancelled) return;
     
     try {
       console.log('Fetching form data...');
       //create reference to followUps collection in firestore
       const dataCollection = collection(db, 'followUps');
       //get the docs from collection (followUps)
       const querySnapshot = await getDocs(dataCollection);
       const forms = [];
       querySnapshot.forEach((doc) => {
         // Add each document's data to our array
         const data = doc.data();
         if (data) {
           forms.push({ id: doc.id, ...data });
         }
       });
       
       if (!isCancelled) {
         console.log('Fetched', forms.length, 'records');
         //stores all the variables from (forms) into formData
         setFormData(forms);
         setLoading(false);
       }
     } catch (err) {
       if (!isCancelled) {
         console.error('Error fetching form data:', err);
         setError(`Failed to load form data: ${err.message}`);
         setLoading(false);
       }
     }
   };

   //if current user exists, fetch data
   if (currentUser) {
     fetchFormData();
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




 //group people by their building/block number
 const groupByBuilding = (data) => {
   if (!Array.isArray(data)) return {};
   //transforms array into a object using reduce()
   //acc is the accumulator, the object being built
   //person is the current object being processed
   return data.reduce((acc, person) => {
     if (!person) return acc;
     //either the person is in a building/block or 'Unassigned' if none
     const block = person.block || person['Building/Block'] || 'Unassigned';
     if (!acc[block]) {
       acc[block] = [];
     }
     acc[block].push(person);
     return acc;
   }, {});
 };


 // Handles clicking on a building/block header
 const handleBlockClick = (block) => {
   setExpandedBlock(expandedBlock === block ? null : block);
   setExpandedPerson(null);  // Close any open person details
 };


// Handles clicking on a person's name to show/hide details
 const handlePersonClick = (personId) => {
   setExpandedPerson(expandedPerson === personId ? null : personId);
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
       <h1>Community Members by Building</h1>
     </div>
     {formData && formData.length > 0 ? (
       <div className="buildings-list">
         {Object.entries(groupByBuilding(formData))
           // Sort buildings numerically/alphabetically
           .sort(([a], [b]) => String(a || '').localeCompare(String(b || '')))
           .map(([block, people]) => (
             // Building Section: Contains header and collapsible content
             <div key={block} className="building-section">
               <div
                 className={`building-header ${expandedBlock === block ? 'expanded' : ''}`}
                 onClick={() => handleBlockClick(block)}
               >
                 <h2>Building/Block {block}</h2>
                 <span className="person-count">{people.length} {people.length === 1 ? 'person' : 'people'}</span>
                 <span className="expand-icon">{expandedBlock === block ? '−' : '+'}</span>
               </div>
               {expandedBlock === block && (
                 <div className="people-list">
                   {people.filter(person => person).map((person) => (
                     <div key={person.id} className="person-section">
                       <div
                         className={`person-header ${expandedPerson === person.id ? 'expanded' : ''}`}
                         onClick={() => handlePersonClick(person.id)}
                       >
                         <h3>{person.name || person.Name || 'Unnamed Person'}</h3>
                         <span className="expand-icon">{expandedPerson === person.id ? '−' : '+'}</span>
                       </div>
                       {expandedPerson === person.id && (
                         <div className="person-details">
                           <div className="details-grid">
                             {/* Basic Information */}
                             <div className="detail-item">
                               <label>Age</label>
                               <span>{person.age || person.Age || 'N/A'}</span>
                             </div>
                             <div className="detail-item">
                               <label>Apt #/ House #</label>
                               <span>{person.unit || person['Apt #/ House #'] || 'N/A'}</span>
                             </div>
                             <div className="detail-item">
                               <label>Phone</label>
                               <span>{person.phone || person.Phone || 'N/A'}</span>
                             </div>
                             <div className="detail-item">
                               <label>Team/Route</label>
                               <span>{person.team || person['Route Leader'] || 'N/A'}</span>
                             </div>
                             <div className="detail-item">
                               <label>Date</label>
                               <span>
                                 {person.date
                                   ? new Date(person.date).toLocaleDateString()
                                   : person.Date && person.Date.seconds
                                   ? new Date(person.Date.seconds * 1000).toLocaleDateString()
                                   : person.Date
                                   ? new Date(person.Date).toLocaleDateString()
                                   : 'N/A'
                                 }
                               </span>
                             </div>
                             <div className="detail-item full-width">
                               <label>Current Involvement</label>
                               <span className="notes-text">{person.involvement || person['Current Involvement'] || 'No involvement information provided'}</span>
                             </div>
                             <div className="detail-item full-width">
                               <label>Follow-up</label>
                               <span className="notes-text">{person.followUp || person['Follow-up'] || 'No follow-up information'}</span>
                             </div>
                             <div className="detail-item full-width">
                               <label>Notes</label>
                               <span className="notes-text">{person.notes || person.Notes || 'No notes available'}</span>
                             </div>
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
         <p>No form data available.</p>
         <button 
           type="button"
           onClick={() => navigate('/followups/new')} 
           className="collect-button"
         >
           Start Collecting Data
         </button>
       </div>
     )}
   </div>
 );
};


export default PersonDetails;


