import { NextResponse } from "next/server";
import { collection, addDoc, query, orderBy, getDocs, limit, where, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase";

export async function GET() {
  try {
    const q = query(
      collection(db, "queue"),
      where("status", "in", ["current", "next", "delayed"])
    );
    const snapshot = await getDocs(q);
    
    const queue = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    queue.sort((a: any, b: any) => (a.orderIndex ?? a.tokenNumber) - (b.orderIndex ?? b.tokenNumber));

    return NextResponse.json({ success: true, queue });
  } catch (error) {
    console.error("GET /api/queue error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type } = body;
    
    if (!name || (type !== "Online" && type !== "Walk-in")) {
      return NextResponse.json({ success: false, error: "Invalid request data" }, { status: 400 });
    }

    // Reuse exact logic from client side
    const maxQ = query(collection(db, "queue"), orderBy("tokenNumber", "desc"), limit(1));
    const maxSnapshot = await getDocs(maxQ);
    let nextToken = 1;
    if (!maxSnapshot.empty) {
      nextToken = maxSnapshot.docs[0].data().tokenNumber + 1;
    }

    // Determine initial status based on existing incomplete patients
    const q = query(collection(db, "queue"), where("status", "in", ["current", "next", "delayed"]));
    const activeSnapshot = await getDocs(q);
    const hasIncomplete = !activeSnapshot.empty;
    const initialStatus = hasIncomplete ? "next" : "current";
    
    const docData = {
      tokenNumber: nextToken,
      orderIndex: nextToken,
      name: name.trim(),
      type: type,
      status: initialStatus,
      clinicId: "default",
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "queue"), docData);

    return NextResponse.json({ 
      success: true, 
      patient: { id: docRef.id, ...docData } 
    }, { status: 201 });
    
  } catch (error) {
    console.error("POST /api/queue error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
