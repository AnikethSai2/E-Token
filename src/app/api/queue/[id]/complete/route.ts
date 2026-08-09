import { NextResponse } from "next/server";
import { doc, updateDoc, query, collection, where, getDocs, getDoc } from "firebase/firestore";
import { db } from "../../../../../firebase";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    // Validate existence
    const currentRef = doc(db, "queue", id);
    const currentSnap = await getDoc(currentRef);
    if (!currentSnap.exists()) {
       return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
    }

    // Complete the requested patient
    await updateDoc(currentRef, { status: "completed" });

    // Promote the next patient
    const q = query(
      collection(db, "queue"),
      where("status", "in", ["current", "next", "delayed"])
    );
    const snapshot = await getDocs(q);
    
    const patients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
    
    // Sort to find the next person (who is not the current patient)
    patients.sort((a, b) => (a.orderIndex ?? a.tokenNumber) - (b.orderIndex ?? b.tokenNumber));
    
    const nextPatient = patients.find(p => p.id !== id);

    if (nextPatient) {
      await updateDoc(doc(db, "queue", nextPatient.id), { status: "current" });
    }

    return NextResponse.json({ success: true, message: "Patient completed and next promoted" }, { status: 200 });
    
  } catch (error) {
    console.error("POST /api/queue/[id]/complete error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
