import { doc, getDocFromServer, runTransaction, serverTimestamp } from './cloud/store';
type Database = unknown;

export async function confirmJobArrival(database: Database, uid: string, jobId: string, coords: { latitude: number; longitude: number; accuracy_m: number }) {
  if (!uid) throw new Error('Sign in before confirming arrival.');
  if (![coords.latitude, coords.longitude, coords.accuracy_m].every(Number.isFinite) || Math.abs(coords.latitude)>90 || Math.abs(coords.longitude)>180 || coords.accuracy_m<0) {
    throw new Error('A valid location is required. Allow location access and try again.');
  }
  try { return await runTransaction(database, async transaction => {
    const jobRef=doc(database,'shifts',jobId),arrivalRef=doc(database,'attendance_logs',jobId);
    const job=await transaction.get(jobRef);
    if (!job.exists()) throw new Error('This job is no longer available. Ask the office to check the assignment.');
    const current=job.data();
    if (current.technician_id!==uid) throw new Error('This job is assigned to another technician. Ask the office to check the assignment.');
    if (current.status==='draft') throw new Error('The office has saved this job as a draft. An administrator must schedule it before you can confirm arrival.');
    if (current.is_deleted || !['assigned','in_progress'].includes(current.status||'assigned')) throw new Error('This job is no longer open for arrival. Ask the office to check its status.');
    const arrival=await transaction.get(arrivalRef);
    // Retrying an already confirmed arrival must never replace its original time or GPS.
    if (arrival.exists()) return;
    if ((current.status||'assigned')!=='assigned') throw new Error('This job has started but its arrival record is missing. Ask the office to check it.');
    transaction.set(arrivalRef,{technician_id:uid,...coords,timestamp:serverTimestamp()});
    transaction.update(jobRef,{status:'in_progress',arrived_at:serverTimestamp()});
  }); } catch (error: any) {
    // Concurrent clients may receive permission-denied before a transaction conflict:
    // the other request created the immutable attendance record first.
    if (error?.code==='permission-denied' || error?.code==='aborted' || error?.status===409 || error?.code==='409') {
      try {
        const [arrival,job]=await Promise.all([
          getDocFromServer(doc(database,'attendance_logs',jobId)),
          getDocFromServer(doc(database,'shifts',jobId)),
        ]);
        if (arrival.exists() && job.exists() && arrival.data().technician_id===uid && job.data().technician_id===uid && !job.data().is_deleted && ['in_progress','completed'].includes(job.data().status)) return;
      } catch { /* Preserve the original failure if confirmation cannot be verified. */ }
    }
    throw error;
  }
}
