import { NextResponse } from "next/server";
import { doc, updateDoc, query, collection, where, getDocs } from "firebase/firestore";
import { db } from "../../../../firebase";

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;
    const body = await request.json();
    
    if (body.status !== "delayed") {
      if (body.status) {
        await updateDoc(doc(db, "queue", id), { status: body.status });
        return NextResponse.json({ success: true, message: "Status updated" });
      }
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    // 1-position swap logic for delayed
    const q = query(
      collection(db, "queue"),
      where("status", "in", ["current", "next", "delayed"])
    );
    const snapshot = await getDocs(q);
    
    const patients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
    
    patients.sort((a, b) => (a.orderIndex ?? a.tokenNumber) - (b.orderIndex ?? b.tokenNumber));
    
    const myDocIndex = patients.findIndex(p => p.id === id);
    if (myDocIndex === -1) {
      return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
    }
    
    if (myDocIndex === patients.length - 1) {
      return NextResponse.json({ success: true, message: "Nobody behind, no swap made" });
    }

    const myDoc = patients[myDocIndex];
    const nextDoc = patients[myDocIndex + 1];

    const myOrder = myDoc.orderIndex ?? myDoc.tokenNumber;
    const nextOrder = nextDoc.orderIndex ?? nextDoc.tokenNumber;

    // Execute swap
    await updateDoc(doc(db, "queue", myDoc.id), { 
      orderIndex: nextOrder,
      status: "delayed"
    });
    await updateDoc(doc(db, "queue", nextDoc.id), { 
      orderIndex: myOrder
    });

    return NextResponse.json({ success: true, message: "Patient delayed and swapped 1 position" });
    
  } catch (error) {
    console.error("PATCH /api/queue/[id] error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
