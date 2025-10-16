import {useEffect, useState} from 'react';
import { db } from "../services/firebase";
import { collection, getDocs, deleteDoc, doc} from "firebase/firestore";

export default function AdminUserPage() {
    const[users, setUsers] = useState([]);
}