
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  updateDoc, 
  arrayUnion, 
  Timestamp,
  getDoc,
  deleteDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { Conversation, ChatMessage } from "../types";

export const chatService = {
  getChatId: (id1: string, id2: string) => {
    return [id1, id2].sort().join("_");
  },

  // Listen for all conversations in a classroom for a specific student
  subscribeToConversations: (teacherEmail: string, studentId: string, callback: (conversations: Conversation[]) => void) => {
    if (!teacherEmail || !studentId) return () => {};
    const classroomId = teacherEmail.toLowerCase().trim();
    const chatsRef = collection(db, "classrooms", classroomId, "chats");
    
    // Query for chats where this student is a participant
    // Note: Since we use a combined ID, we might need to query by participantIds array
    const q = query(chatsRef, where("participantIds", "array-contains", studentId));

    return onSnapshot(q, (snapshot) => {
      const conversations: Conversation[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const otherParticipantId = data.participantIds.find((id: string) => id !== studentId);
        
        conversations.push({
          participantId: otherParticipantId,
          initiatorId: data.initiatorId,
          status: data.status,
          messages: data.messages || []
        });
      });
      callback(conversations);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, chatsRef.path);
    });
  },

  sendRequest: async (teacherEmail: string, fromId: string, toId: string) => {
    if (!teacherEmail || !fromId || !toId) return;
    console.log(`[ChatService] Sending request from ${fromId} to ${toId} in classroom ${teacherEmail}`);
    const classroomId = teacherEmail.toLowerCase().trim();
    const chatId = chatService.getChatId(fromId, toId);
    const chatRef = doc(db, "classrooms", classroomId, "chats", chatId);

    const chatDoc = await getDoc(chatRef);
    if (chatDoc.exists()) {
      const data = chatDoc.data();
      console.log(`[ChatService] Existing chat found with status: ${data.status}`);
      // If there's an incoming pending request, this mutual request acts as an acceptance
      if (data.status === 'pending' && data.initiatorId === toId) {
        console.log(`[ChatService] Mutual request detected. Accepting automatically.`);
        await updateDoc(chatRef, {
          status: 'accepted',
          updatedAt: Timestamp.now()
        });
        return;
      }
      // If already accepted or pending from us, do nothing
      if (data.status === 'accepted' || (data.status === 'pending' && data.initiatorId === fromId)) {
        return;
      }
    }

    // Create or overwrite (if rejected/cancelled)
    await setDoc(chatRef, {
      participantIds: [fromId, toId],
      initiatorId: fromId,
      status: 'pending',
      messages: [],
      updatedAt: Timestamp.now()
    });
    console.log(`[ChatService] Request document created.`);
  },

  respondToRequest: async (teacherEmail: string, fromId: string, toId: string, accepted: boolean) => {
    if (!teacherEmail || !fromId || !toId) return;
    const classroomId = teacherEmail.toLowerCase().trim();
    const chatId = chatService.getChatId(fromId, toId);
    const chatRef = doc(db, "classrooms", classroomId, "chats", chatId);

    if (accepted) {
      await updateDoc(chatRef, {
        status: 'accepted',
        updatedAt: Timestamp.now()
      });
    } else {
      // Deleting on rejection allows for a fresh start later if they change their mind
      await deleteDoc(chatRef);
    }
  },

  cancelRequest: async (teacherEmail: string, fromId: string, toId: string) => {
    if (!teacherEmail || !fromId || !toId) return;
    const classroomId = teacherEmail.toLowerCase().trim();
    const chatId = chatService.getChatId(fromId, toId);
    const chatRef = doc(db, "classrooms", classroomId, "chats", chatId);

    await deleteDoc(chatRef);
  },

  sendMessage: async (teacherEmail: string, fromId: string, toId: string, text: string) => {
    const classroomId = teacherEmail.toLowerCase().trim();
    const chatId = chatService.getChatId(fromId, toId);
    const chatRef = doc(db, "classrooms", classroomId, "chats", chatId);

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: fromId,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    await updateDoc(chatRef, {
      messages: arrayUnion(newMessage),
      updatedAt: Timestamp.now()
    });
  },

  // Presence tracking (Simplified for now, could use Realtime Database for true presence)
  updatePresence: async (teacherEmail: string, studentId: string, isOnline: boolean) => {
    const classroomId = teacherEmail.toLowerCase().trim();
    const presenceRef = doc(db, "classrooms", classroomId, "presence", studentId);
    await setDoc(presenceRef, {
      isOnline,
      lastSeen: Timestamp.now()
    });
  },

  subscribeToPresence: (teacherEmail: string, callback: (onlineIds: string[]) => void) => {
    const classroomId = teacherEmail.toLowerCase().trim();
    const presenceRef = collection(db, "classrooms", classroomId, "presence");
    
    return onSnapshot(presenceRef, (snapshot) => {
      const onlineIds: string[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Threshold: if lastSeen is within last 5 minutes (more generous for heartbeat)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (data.isOnline && data.lastSeen && data.lastSeen.toMillis() > fiveMinutesAgo) {
          onlineIds.push(doc.id);
        }
      });
      callback(onlineIds);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, presenceRef.path);
    });
  }
};
