"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp, getDocs, limit, where } from "firebase/firestore";
import { db } from "../../firebase";

type Patient = {
  id: string;
  tokenNumber: number;
  orderIndex: number;
  name: string;
  type: "Online" | "Walk-in";
  status: "current" | "next" | "delayed" | "completed";
};

export default function AttendantPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [newWalkInName, setNewWalkInName] = useState("");
  const [loading, setLoading] = useState(true);

  // Listen to active queue
  useEffect(() => {
    const q = query(
      collection(db, "queue"),
      where("status", "in", ["current", "next", "delayed"])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Patient[];
      
      // Sort by orderIndex
      patientsData.sort((a, b) => (a.orderIndex ?? a.tokenNumber) - (b.orderIndex ?? b.tokenNumber));
      setPatients(patientsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCompleteCurrent = async () => {
    const currentPatient = patients.find(p => p.status === "current");
    
    try {
      if (currentPatient) {
        await updateDoc(doc(db, "queue", currentPatient.id), { status: "completed" });
      }

      // Find next available (the first person in the sorted array who is not the current patient)
      const nextPatient = patients.find(p => p.id !== currentPatient?.id);

      if (nextPatient) {
        await updateDoc(doc(db, "queue", nextPatient.id), { status: "current" });
      }
    } catch (error) {
      console.error("Error completing patient:", error);
    }
  };

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalkInName.trim()) return;
    
    try {
      const maxQ = query(collection(db, "queue"), orderBy("tokenNumber", "desc"), limit(1));
      const maxSnapshot = await getDocs(maxQ);
      let nextToken = 1;
      if (!maxSnapshot.empty) {
        nextToken = maxSnapshot.docs[0].data().tokenNumber + 1;
      }
      
      const hasIncomplete = patients.some(p => p.status !== "completed");
      const initialStatus = hasIncomplete ? "next" : "current";
      
      await addDoc(collection(db, "queue"), {
        tokenNumber: nextToken,
        orderIndex: nextToken,
        name: newWalkInName.trim(),
        type: "Walk-in",
        status: initialStatus,
        createdAt: serverTimestamp(),
      });
      
      setNewWalkInName("");
    } catch (error) {
      console.error("Error adding walk-in:", error);
    }
  };

  const markDelayed = async (id: string) => {
    const myDocIndex = patients.findIndex(p => p.id === id);
    if (myDocIndex === -1 || myDocIndex === patients.length - 1) return; // Nobody behind
    
    const myDoc = patients[myDocIndex];
    const nextDoc = patients[myDocIndex + 1];

    const myOrder = myDoc.orderIndex ?? myDoc.tokenNumber;
    const nextOrder = nextDoc.orderIndex ?? nextDoc.tokenNumber;

    try {
      // Swap orderIndex
      await updateDoc(doc(db, "queue", myDoc.id), { 
        orderIndex: nextOrder,
        status: "delayed"
      });
      await updateDoc(doc(db, "queue", nextDoc.id), { 
        orderIndex: myOrder
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 text-gray-900">
      <div className="max-w-5xl w-full space-y-8">
        
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900">Clinic Dashboard</h2>
            <p className="mt-1 text-sm text-gray-600">Manage the patient queue</p>
          </div>
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-500 font-medium">
             &larr; Back Home
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Current Patient & Add Walk-in */}
          <div className="md:col-span-1 space-y-6">
            
            {/* Current Patient Card */}
            <div className="bg-white p-6 rounded-2xl shadow-md border-t-4 border-blue-600">
              <h3 className="text-sm uppercase tracking-wide text-gray-500 font-bold mb-4">Currently Serving</h3>
              {patients.filter(p => p.status === "current").map(p => (
                <div key={p.id} className="text-center">
                  <div className="text-6xl font-black text-gray-900 mb-2">#{p.tokenNumber}</div>
                  <div className="text-xl font-medium text-gray-800">{p.name}</div>
                  <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    {p.type}
                  </div>
                  <button
                    onClick={handleCompleteCurrent}
                    className="mt-6 w-full py-3 px-4 rounded-xl text-white bg-green-600 hover:bg-green-700 font-medium shadow-sm transition-colors"
                  >
                    Complete & Next
                  </button>
                </div>
              ))}
              {patients.filter(p => p.status === "current").length === 0 && (
                <div className="text-center text-gray-500 py-6">
                  No active patient
                </div>
              )}
            </div>

            {/* Add Walk-in */}
            <div className="bg-white p-6 rounded-2xl shadow-md">
              <h3 className="text-sm uppercase tracking-wide text-gray-500 font-bold mb-4">Add Walk-in</h3>
              <form onSubmit={handleAddWalkIn} className="space-y-4">
                <input
                  type="text"
                  placeholder="Patient Name"
                  required
                  value={newWalkInName}
                  onChange={(e) => setNewWalkInName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg text-white bg-gray-800 hover:bg-gray-900 font-medium transition-colors"
                >
                  Add to Queue
                </button>
              </form>
            </div>

          </div>

          {/* Right Column: Queue List */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-md overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg leading-6 font-semibold text-gray-900">Queue List</h3>
            </div>
            <ul className="divide-y divide-gray-200 overflow-y-auto flex-1 max-h-[600px]">
              {patients.map((p) => (
                <li key={p.id} className={`p-6 hover:bg-gray-50 transition-colors ${p.status === "current" ? "bg-blue-50/50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                        p.status === "current" ? "bg-blue-600 text-white shadow-md" : 
                        p.status === "delayed" ? "bg-amber-100 text-amber-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {p.tokenNumber}
                      </div>
                      <div>
                        <p className="text-lg font-medium text-gray-900">{p.name}</p>
                        <div className="flex space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            p.type === "Online" ? "bg-purple-100 text-purple-800" : "bg-teal-100 text-teal-800"
                          }`}>
                            {p.type}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            p.status === "current" ? "bg-blue-100 text-blue-800" :
                            p.status === "delayed" ? "bg-amber-100 text-amber-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {p.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    {p.status !== "current" && (
                      <button 
                        onClick={() => markDelayed(p.id)}
                        className="px-3 py-1 text-sm border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        Mark Delayed (Swap 1)
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {patients.length === 0 && (
                <li className="p-8 text-center text-gray-500">Queue is empty</li>
              )}
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
