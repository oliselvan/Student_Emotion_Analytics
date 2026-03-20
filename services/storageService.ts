
import { StudentRecord } from "../types";
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  arrayUnion
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";

// Helper to remove undefined values for Firestore and add search metadata
const sanitize = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  
  const sanitized: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      sanitized[key] = sanitize(obj[key]);
    }
  }

  // Add normalizedName for efficient case-insensitive search if it's a student record
  if (sanitized.name) {
    sanitized.normalizedName = normalizeName(sanitized.name);
  }

  return sanitized;
};

// Helper for safe localStorage operations
export const safeLocalStorage = {
  setItem: (key: string, value: string) => {
    try {
      const size = new Blob([value]).size;
      if (size > 1024 * 1024) {
        console.warn(`Attempting to save large item to LocalStorage: ${key} (${(size / 1024 / 1024).toFixed(2)} MB)`);
      }
      localStorage.setItem(key, value);
    } catch (e) {
      if (e instanceof DOMException && (
        e.code === 22 || 
        e.code === 1014 || 
        e.name === 'QuotaExceededError' || 
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        console.warn("LocalStorage quota exceeded. Clearing old backups to make room.");
        // Clear all slp_backup keys to free up space
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('slp_backup_')) {
            localStorage.removeItem(k);
          }
        });
        // Try one more time after clearing
        try {
          localStorage.setItem(key, value);
        } catch (retryError) {
          console.error("Failed to set item even after clearing backups:", retryError);
        }
      } else {
        console.error("LocalStorage error:", e);
      }
    }
  },
  getItem: (key: string) => localStorage.getItem(key),
  removeItem: (key: string) => localStorage.removeItem(key)
};

// Helper to normalize names (lowercase, trim, collapse spaces)
const normalizeName = (name: string): string => {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

// Helper to strip large fields for local backup
const stripForBackup = (students: StudentRecord[]): any[] => {
  return students.map(s => ({
    ...s,
    history: [], // History is too large for localStorage
    feedback: [], // Feedback can grow large
    conversations: [], // Conversations can grow very large
    // Strip base64 avatars to save space, but keep URLs (DiceBear)
    avatar: s.avatar?.startsWith('data:image') ? '' : s.avatar
  }));
};

export const storageService = {
  subscribeToStudents: (teacherEmail: string, callback: (students: StudentRecord[]) => void) => {
    if (!teacherEmail) return () => {};
    const classroomId = teacherEmail.toLowerCase().trim();
    const studentsRef = collection(db, "classrooms", classroomId, "students");
    
    return onSnapshot(studentsRef, (snapshot) => {
      const students = snapshot.docs.map(doc => doc.data() as StudentRecord);
      callback(students.sort((a, b) => a.name.localeCompare(b.name)));
      
      // Update local backup with stripped data
      safeLocalStorage.setItem(`slp_backup_${teacherEmail}`, JSON.stringify(stripForBackup(students)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, studentsRef.path);
    });
  },

  getStudents: async (teacherEmail: string): Promise<StudentRecord[]> => {
    if (!teacherEmail) return [];
    try {
      const classroomId = teacherEmail.toLowerCase().trim();
      const studentsRef = collection(db, "classrooms", classroomId, "students");
      const snapshot = await getDocs(studentsRef);
      const students = snapshot.docs.map(doc => doc.data() as StudentRecord);
      
      return students.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, `classrooms/${teacherEmail}/students`);
      const local = safeLocalStorage.getItem(`slp_backup_${teacherEmail}`);
      return local ? JSON.parse(local) : [];
    }
  },

  getStudentByName: async (teacherEmail: string, name: string): Promise<StudentRecord | null> => {
    if (!teacherEmail || !name) return null;
    const classroomId = teacherEmail.toLowerCase().trim();
    const normalizedName = normalizeName(name);
    
    try {
      const studentsRef = collection(db, "classrooms", classroomId, "students");
      const q = query(studentsRef, where("normalizedName", "==", normalizedName));
      
      // Try cache first for instant response
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (e) {
        console.warn("Cache fetch failed, trying server...", e);
        snapshot = await getDocs(q);
      }
      
      if (!snapshot.empty) {
        return snapshot.docs[0].data() as StudentRecord;
      }
      
      // Fallback for legacy records or cache misses
      const allSnapshot = await getDocs(studentsRef);
      if (allSnapshot.empty) return null;

      const found = allSnapshot.docs
        .map(d => d.data() as StudentRecord)
        .find(s => normalizeName(s.name) === normalizedName);

      // If found via fallback, update it with normalizedName for next time
      if (found && !found.normalizedName) {
        storageService.updateStudent(teacherEmail, found.id, { normalizedName });
      }

      return found || null;
    } catch (e) {
      console.error("Search failed:", e);
      return null;
    }
  },

  getStudentByEmail: async (teacherEmail: string, email: string): Promise<StudentRecord | null> => {
    if (!teacherEmail || !email) return null;
    const classroomId = teacherEmail.toLowerCase().trim();
    const normalizedEmail = email.trim().toLowerCase();
    
    try {
      const studentsRef = collection(db, "classrooms", classroomId, "students");
      const q = query(studentsRef, where("email", "==", normalizedEmail));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        return snapshot.docs[0].data() as StudentRecord;
      }
      
      // Fallback: check all
      const allSnapshot = await getDocs(studentsRef);
      return allSnapshot.docs
        .map(d => d.data() as StudentRecord)
        .find(s => s.email?.toLowerCase() === normalizedEmail) || null;
    } catch (e) {
      console.error("Email search failed:", e);
      return null;
    }
  },
  
  saveStudents: async (teacherEmail: string, students: StudentRecord[], forceWipe: boolean = false) => {
    if (!teacherEmail || !Array.isArray(students)) return;
    
    const classroomId = teacherEmail.toLowerCase().trim();
    const studentsRef = collection(db, "classrooms", classroomId, "students");

    try {
      if (forceWipe) {
        const snapshot = await getDocs(studentsRef);
        // Chunk deletions
        for (let i = 0; i < snapshot.docs.length; i += 500) {
          const batch = writeBatch(db);
          snapshot.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      // Chunk saves
      for (let i = 0; i < students.length; i += 500) {
        const batch = writeBatch(db);
        students.slice(i, i + 500).forEach(student => {
          const studentRef = doc(db, "classrooms", classroomId, "students", student.id);
          batch.set(studentRef, sanitize(student), { merge: true });
        });
        await batch.commit();
      }

      safeLocalStorage.setItem(`slp_backup_${teacherEmail}`, JSON.stringify(stripForBackup(students)));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `classrooms/${teacherEmail}/students`);
      safeLocalStorage.setItem(`slp_backup_${teacherEmail}`, JSON.stringify(stripForBackup(students)));
    }
  },

  addStudent: async (teacherEmail: string, student: StudentRecord) => {
    if (!teacherEmail || !student) return;
    
    // Update local backup immediately
    const local = safeLocalStorage.getItem(`slp_backup_${teacherEmail}`);
    const students = local ? JSON.parse(local) : [];
    safeLocalStorage.setItem(`slp_backup_${teacherEmail}`, JSON.stringify(stripForBackup([...students, student])));

    try {
      const classroomId = teacherEmail.toLowerCase().trim();
      const studentRef = doc(db, "classrooms", classroomId, "students", student.id);
      
      const sanitized = sanitize(student);
      const size = new Blob([JSON.stringify(sanitized)]).size;
      
      if (size > 900 * 1024) {
        console.warn(`Student record ${student.id} is very large: ${(size / 1024).toFixed(2)} KB.`);
      }

      await setDoc(studentRef, sanitized);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `classrooms/${teacherEmail}/students/${student.id}`);
      throw e;
    }
  },

  updateStudent: async (teacherEmail: string, studentId: string, updates: Partial<StudentRecord>) => {
    if (!teacherEmail || !studentId) return;

    // Update local backup immediately
    const local = safeLocalStorage.getItem(`slp_backup_${teacherEmail}`);
    if (local) {
      const students = JSON.parse(local) as StudentRecord[];
      const updated = students.map(s => s.id === studentId ? { ...s, ...updates } : s);
      safeLocalStorage.setItem(`slp_backup_${teacherEmail}`, JSON.stringify(stripForBackup(updated)));
    }

    try {
      const classroomId = teacherEmail.toLowerCase().trim();
      const studentRef = doc(db, "classrooms", classroomId, "students", studentId);
      
      const sanitized = sanitize(updates);
      const size = new Blob([JSON.stringify(sanitized)]).size;
      
      if (size > 800 * 1024) { // 800KB limit for safety (Firestore limit is 1MB)
        console.error(`Update for student ${studentId} is too large: ${(size / 1024).toFixed(2)} KB. Stripping large fields.`);
        if (sanitized.avatar && sanitized.avatar.startsWith('data:image')) {
          sanitized.avatar = ""; // Strip avatar if it's the problem
        }
      }

      await updateDoc(studentRef, sanitized);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `classrooms/${teacherEmail}/students/${studentId}`);
    }
  },

  appendToStudentHistory: async (teacherEmail: string, studentId: string, analysis: any) => {
    if (!teacherEmail || !studentId) return;

    // Update local backup immediately
    const local = safeLocalStorage.getItem(`slp_backup_${teacherEmail}`);
    if (local) {
      const students = JSON.parse(local) as StudentRecord[];
      const updated = students.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            // We don't store history in backup anymore, but we update lastAnalysis
            lastAnalysis: analysis,
            isFlagged: analysis.stressScore >= 7
          };
        }
        return s;
      });
      safeLocalStorage.setItem(`slp_backup_${teacherEmail}`, JSON.stringify(stripForBackup(updated)));
    }

    try {
      const classroomId = teacherEmail.toLowerCase().trim();
      const studentRef = doc(db, "classrooms", classroomId, "students", studentId);
      await updateDoc(studentRef, {
        history: arrayUnion(sanitize(analysis)),
        lastAnalysis: sanitize(analysis),
        isFlagged: analysis.stressScore >= 7
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `classrooms/${teacherEmail}/students/${studentId}/history`);
    }
  },

  appendToStudentFeedback: async (teacherEmail: string, studentId: string, feedback: any) => {
    if (!teacherEmail || !studentId) return;

    // Update local backup immediately
    const local = safeLocalStorage.getItem(`slp_backup_${teacherEmail}`);
    if (local) {
      const students = JSON.parse(local) as StudentRecord[];
      const updated = students.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            // Feedback is not stored in backup anymore
          };
        }
        return s;
      });
      safeLocalStorage.setItem(`slp_backup_${teacherEmail}`, JSON.stringify(stripForBackup(updated)));
    }

    try {
      const classroomId = teacherEmail.toLowerCase().trim();
      const studentRef = doc(db, "classrooms", classroomId, "students", studentId);
      await updateDoc(studentRef, {
        feedback: arrayUnion(sanitize(feedback))
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `classrooms/${teacherEmail}/students/${studentId}/feedback`);
    }
  },

  deleteStudent: async (teacherEmail: string, studentId: string) => {
    if (!teacherEmail || !studentId) return;

    // Update local backup immediately
    const local = safeLocalStorage.getItem(`slp_backup_${teacherEmail}`);
    if (local) {
      const students = JSON.parse(local) as StudentRecord[];
      const updated = students.filter(s => s.id !== studentId);
      safeLocalStorage.setItem(`slp_backup_${teacherEmail}`, JSON.stringify(stripForBackup(updated)));
    }

    try {
      const classroomId = teacherEmail.toLowerCase().trim();
      const studentRef = doc(db, "classrooms", classroomId, "students", studentId);
      await deleteDoc(studentRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `classrooms/${teacherEmail}/students/${studentId}`);
    }
  },

  saveAccountInfo: async (email: string, role: string, name?: string, picture?: string) => {
    try {
      const userRef = doc(db, "users", email.toLowerCase().trim());
      await setDoc(userRef, {
        email: email.toLowerCase().trim(),
        role,
        name: name || null,
        picture: picture || null,
        lastLogin: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${email}`);
    }
  },
  
  clearAllForUser: async (email: string) => {
    if (!email) return;
    safeLocalStorage.removeItem(`slp_backup_${email}`);
    // Potentially delete from Firestore too if requested
  },

  exportToJSON: (students: StudentRecord[], email: string) => {
    const dataStr = JSON.stringify(students, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const filename = `slp_backup_${email}_${new Date().toISOString().split('T')[0]}.json`;
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', filename);
    link.click();
  },

  importFromJSON: async (file: File, email: string): Promise<StudentRecord[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (Array.isArray(json)) {
            await storageService.saveStudents(email, json, true); // Force wipe on import
            resolve(json);
          } else {
            reject(new Error("Invalid format."));
          }
        } catch (e) {
          reject(e);
        }
      };
      reader.readAsText(file);
    });
  }
};
