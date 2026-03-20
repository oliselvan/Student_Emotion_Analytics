
import React, { useState } from 'react';
import { StudentRecord, Conversation, ChatMessage } from '../types';

interface StudentChatProps {
  currentStudent: StudentRecord;
  allStudents: StudentRecord[];
  onlineStudentIds: string[];
  onSendRequest: (targetId: string) => void;
  onRespondRequest: (targetId: string, accept: boolean) => void;
  onCancelRequest: (targetId: string) => void;
  onSendMessage: (targetId: string, text: string) => void;
}

const StudentChat: React.FC<StudentChatProps> = ({ 
  currentStudent, 
  allStudents, 
  onlineStudentIds,
  onSendRequest, 
  onRespondRequest, 
  onCancelRequest,
  onSendMessage 
}) => {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');

  const otherStudents = allStudents.filter(s => s.id !== currentStudent.id);
  
  const conversations = currentStudent?.conversations || [];
  const activeConversation = conversations.find(c => c.participantId === activeChatId);
  const targetStudent = allStudents.find(s => s.id === activeChatId);

  const getConvStatus = (id: string) => {
    return conversations.find(c => c.participantId === id);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeChatId && msgInput.trim()) {
      onSendMessage(activeChatId, msgInput.trim());
      setMsgInput('');
    }
  };

  // Check if current user is the initiator of a pending request
  const isInitiator = activeConversation?.status === 'pending' && activeConversation.initiatorId === currentStudent.id;

  return (
    <div className="flex h-[calc(100vh-160px)] bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Sidebar: List of Peers */}
      <div className="w-80 border-r border-slate-100 dark:border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Study Groups</h3>
          <p className="text-xs text-slate-400 uppercase font-black tracking-widest mt-1">Connect with Peers</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {otherStudents.map(s => {
            const conv = getConvStatus(s.id);
            return (
              <button
                key={s.id}
                onClick={() => setActiveChatId(s.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                  activeChatId === s.id 
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="relative">
                  <img src={s.avatar || null} className="w-10 h-10 rounded-xl" alt={s.name} referrerPolicy="no-referrer" />
                  {onlineStudentIds.includes(s.id) && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-sm" />
                  )}
                  {conv?.status === 'accepted' && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white dark:border-slate-900 rounded-full shadow-sm" />
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{s.name}</p>
                  <p className={`text-[10px] uppercase font-black tracking-tighter ${conv?.status === 'pending' && conv.initiatorId !== currentStudent.id ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`}>
                    {conv?.status === 'pending' && conv.initiatorId !== currentStudent.id ? 'New Request!' : (conv ? conv.status : 'No Connection')}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50/30 dark:bg-slate-950/20">
        {targetStudent ? (
          <>
            {/* Header */}
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={targetStudent.avatar || null} className="w-12 h-12 rounded-2xl" alt={targetStudent.name} referrerPolicy="no-referrer" />
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100">{targetStudent.name}</h4>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${onlineStudentIds.includes(targetStudent.id) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <p className="text-xs text-slate-500">{onlineStudentIds.includes(targetStudent.id) ? 'Online' : 'Offline'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeConversation?.status === 'pending' ? (
                isInitiator ? (
                  /* SENDER UI */
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <div className="text-6xl animate-pulse">📤</div>
                    <div className="space-y-2 max-w-xs">
                      <h3 className="text-xl font-bold dark:text-white">Waiting for Response</h3>
                      <p className="text-sm text-slate-500">You sent a request to {targetStudent.name}. They need to accept it before you can start chatting.</p>
                    </div>
                    <button 
                      onClick={() => onCancelRequest(targetStudent.id)}
                      className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-900"
                    >
                      Cancel Request
                    </button>
                  </div>
                ) : (
                  /* RECEIVER UI */
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95">
                    <div className="text-7xl">📩</div>
                    <div className="space-y-4 max-w-xs mx-auto">
                      <h3 className="text-2xl font-black dark:text-white">New Chat Request</h3>
                      <p className="text-slate-500">{targetStudent.name} wants to connect with you. Accepting allows you to support each other's learning.</p>
                      <div className="flex gap-3 w-full">
                        <button 
                          onClick={() => onRespondRequest(targetStudent.id, true)}
                          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 dark:shadow-none transition-all active:scale-95"
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => onRespondRequest(targetStudent.id, false)}
                          className="flex-1 py-3 bg-white dark:bg-slate-800 text-rose-600 rounded-xl font-bold border border-rose-100 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all active:scale-95"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : activeConversation?.status === 'accepted' ? (
                <>
                  {activeConversation.messages.map((m) => {
                    const isMe = m.senderId === currentStudent.id;
                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] p-4 rounded-3xl text-sm font-medium shadow-sm ${
                          isMe 
                            ? 'bg-emerald-600 text-white rounded-tr-none' 
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700'
                        }`}>
                          {m.text}
                          <p className={`text-[9px] mt-1 opacity-60 ${isMe ? 'text-right' : 'text-left'}`}>
                            {m.timestamp}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {activeConversation.messages.length === 0 && (
                    <div className="text-center py-10 opacity-30 italic text-sm">
                      Connection established. Say hi!
                    </div>
                  )}
                </>
              ) : activeConversation?.status === 'rejected' ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="text-6xl mb-4">🚫</div>
                  <p className="text-slate-500 font-bold">The chat request was declined.</p>
                  {isInitiator && (
                    <p className="text-xs text-slate-400 mt-2">Try checking in with {targetStudent.name} later or focus on your own progress for now.</p>
                  )}
                </div>
              ) : (
                /* No conversation yet - Send Request UI */
                <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95">
                  <div className="text-7xl">🤝</div>
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black dark:text-white">Start a Conversation</h3>
                    <p className="text-slate-500 max-w-xs">Connecting with your peers can help reduce stress and improve collaborative learning.</p>
                    <button 
                      onClick={() => {
                        console.log(`[StudentChat] Triggering onSendRequest for ${targetStudent.id}`);
                        onSendRequest(targetStudent.id);
                      }}
                      className="px-8 py-3 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 dark:shadow-none hover:bg-emerald-700 transition-all active:scale-95"
                    >
                      Send Chat Request
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            {activeConversation?.status === 'accepted' && (
              <form onSubmit={handleSend} className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                <input 
                  type="text" 
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                />
                <button 
                  type="submit"
                  disabled={!msgInput.trim()}
                  className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-2xl shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
            <div className="text-9xl opacity-10">💬</div>
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100">Peer Messenger</h3>
              <p className="text-slate-500 max-w-sm mx-auto">Select a peer from the list to start a supportive academic conversation.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentChat;
