"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp, getDocs, limit, where } from "firebase/firestore";
import { db } from "../../firebase";

type Patient = {
  id: string;
  tokenNumber: number;
  orderIndex: number;
  name: string;
  type: "Online" | "Walk-in";
  status: "current" | "next" | "delayed" | "completed";
  clinicId: string;
};

function PatientContent() {
  const searchParams = useSearchParams();
  const clinicId = searchParams.get("clinicId") || "default";

  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [myDocId, setMyDocId] = useState<string | null>(null);
  
  const [queue, setQueue] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  // Restore session
  useEffect(() => {
    const savedDocId = localStorage.getItem("eTokenPatientDocId");
    if (savedDocId) {
      setMyDocId(savedDocId);
      setJoined(true);
    }
  }, []);

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
      
      // Sort by orderIndex, fallback to tokenNumber
      patientsData.sort((a, b) => (a.orderIndex ?? a.tokenNumber) - (b.orderIndex ?? b.tokenNumber));
      setQueue(patientsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    try {
      const maxQ = query(collection(db, "queue"), orderBy("tokenNumber", "desc"), limit(1));
      const maxSnapshot = await getDocs(maxQ);
      let nextToken = 1;
      if (!maxSnapshot.empty) {
        nextToken = maxSnapshot.docs[0].data().tokenNumber + 1;
      }
      
      const hasIncomplete = queue.some(p => p.status !== "completed");
      const initialStatus = hasIncomplete ? "next" : "current";
      
      const docRef = await addDoc(collection(db, "queue"), {
        tokenNumber: nextToken,
        orderIndex: nextToken,
        name: name.trim(),
        type: "Online",
        status: initialStatus,
        clinicId: clinicId, // Store the clinic ID
        createdAt: serverTimestamp(),
      });
      
      setMyDocId(docRef.id);
      setJoined(true);
      localStorage.setItem("eTokenPatientDocId", docRef.id);
    } catch (error) {
      console.error("Error joining queue:", error);
      alert("Failed to join queue. Please try again.");
    }
  };

  const moveBackOneSpot = async () => {
    if (!myDocId) return;
    const myDocIndex = queue.findIndex(p => p.id === myDocId);
    if (myDocIndex === -1 || myDocIndex === queue.length - 1) return; // Nobody behind me
    
    const myDoc = queue[myDocIndex];
    const nextDoc = queue[myDocIndex + 1];

    const myOrder = myDoc.orderIndex ?? myDoc.tokenNumber;
    const nextOrder = nextDoc.orderIndex ?? nextDoc.tokenNumber;

    try {
      // Swap orderIndex
      await updateDoc(doc(db, "queue", myDocId), { 
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
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading queue...</div>;
  }

  const myData = queue.find(p => p.id === myDocId);
  const currentServing = queue.find(p => p.status === "current");
  
  let tokensAhead = 0;
  if (myData) {
    const myIndex = queue.findIndex(p => p.id === myDocId);
    tokensAhead = Math.max(0, myIndex);
  }

  if (joined && myDocId && !myData && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 text-gray-900">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl text-center">
          <h2 className="text-3xl font-extrabold text-green-600">You're All Set!</h2>
          <p className="text-gray-600">Your turn is complete.</p>
          <button 
            onClick={() => {
              setJoined(false);
              setMyDocId(null);
              localStorage.removeItem("eTokenPatientDocId");
            }}
            className="mt-6 w-full py-3 px-4 rounded-xl text-white bg-blue-600 hover:bg-blue-700 font-medium"
          >
            Join Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 text-gray-900">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">Patient View</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {clinicId !== "default" ? `Clinic ID: ${clinicId}` : "Track your position in the clinic queue"}
          </p>
        </div>

        {!joined || !myData ? (
          <form className="mt-8 space-y-6" onSubmit={handleJoinQueue}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="name" className="sr-only">Full Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="appearance-none rounded-xl relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md"
              >
                Join Queue
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-8 space-y-6 text-center">
            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-sm text-blue-800 font-medium uppercase tracking-wide">Your Token Number</p>
              <p className="text-6xl font-black text-blue-600 mt-2">#{myData.tokenNumber}</p>
              <p className="text-lg text-gray-700 mt-4 font-medium">{myData.name}</p>
              {myData.status === "current" && (
                <div className="mt-4 inline-block bg-green-100 text-green-800 px-4 py-1 rounded-full font-bold text-sm animate-pulse">
                  It's your turn!
                </div>
              )}
              {myData.status === "delayed" && (
                <div className="mt-4 inline-block bg-amber-100 text-amber-800 px-4 py-1 rounded-full font-bold text-sm">
                  You moved back in the queue
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-100 p-4 rounded-xl">
                <p className="text-xs text-gray-500 uppercase font-semibold">Currently Serving</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {currentServing ? `#${currentServing.tokenNumber}` : "-"}
                </p>
              </div>
              <div className="bg-gray-100 p-4 rounded-xl">
                <p className="text-xs text-gray-500 uppercase font-semibold">People Ahead</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{myData.status === "current" ? 0 : tokensAhead}</p>
              </div>
            </div>

            {myData.status !== "current" && (
              <div className="pt-4">
                <button
                  onClick={moveBackOneSpot}
                  className="w-full py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all shadow-sm"
                >
                  I'm delayed (Move back 1 spot)
                </button>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-6 text-center">
           <Link href="/" className="text-sm text-blue-600 hover:text-blue-500 font-medium">
             &larr; Back to Home
           </Link>
        </div>
      </div>
    </div>
  );
}

export default function PatientPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading app...</div>}>
      <PatientContent />
    </Suspense>
  );
}
