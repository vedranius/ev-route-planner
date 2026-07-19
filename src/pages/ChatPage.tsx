import { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured } from '../config/firebase';
import { ref, push, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage } from '../types';

const DEMO_CHAT_KEY = 'evrp_demo_chat';

function getDemoMessages(): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_CHAT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveDemoMessages(msgs: ChatMessage[]) {
  localStorage.setItem(DEMO_CHAT_KEY, JSON.stringify(msgs));
}

export default function ChatPage() {
  const { currentUser, userData } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const chatRef = query(
        ref(db, 'chat/general'),
        orderByChild('timestamp'),
        limitToLast(100)
      );

      const unsubscribe = onValue(chatRef, (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((child) => {
          msgs.push({ id: child.key!, ...child.val() });
        });
        setMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setMessages(getDemoMessages());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      userId: currentUser.uid,
      userName: userData?.displayName || 'Anonymous',
      userPhoto: userData?.photoURL || undefined,
      text: newMessage.trim(),
      timestamp: Date.now(),
    };

    if (isFirebaseConfigured && db) {
      await push(ref(db, 'chat/general'), {
        userId: msg.userId,
        userName: msg.userName,
        userPhoto: msg.userPhoto,
        text: msg.text,
        timestamp: msg.timestamp,
      });
    } else {
      const updated = [...messages, msg];
      setMessages(updated);
      saveDemoMessages(updated);
    }
    setNewMessage('');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[#334155] bg-[#1e293b]">
        <h2 className="text-lg font-bold">EV Drivers Chat</h2>
        <p className="text-sm text-[#94a3b8]">
          Chat with other EV drivers
          {!isFirebaseConfigured && <span className="text-[#f59e0b]"> (Demo Mode - data saved locally)</span>}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-[#94a3b8]">No messages yet. Start the conversation!</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.userId === currentUser?.uid ? 'flex-row-reverse' : ''}`}
          >
            <div className="w-8 h-8 rounded-full bg-[#334155] flex items-center justify-center text-xs font-bold flex-shrink-0">
              {msg.userPhoto ? (
                <img src={msg.userPhoto} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                msg.userName[0].toUpperCase()
              )}
            </div>
            <div className={`max-w-[75%] ${msg.userId === currentUser?.uid ? 'text-right' : ''}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-[#94a3b8]">{msg.userName}</span>
                <span className="text-[10px] text-[#64748b]">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div
                className={`inline-block px-3 py-2 rounded-2xl text-sm ${
                  msg.userId === currentUser?.uid
                    ? 'bg-[#10b981] text-white rounded-br-sm'
                    : 'bg-[#334155] text-[#f1f5f9] rounded-bl-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-[#334155] bg-[#1e293b]">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={currentUser ? 'Type a message...' : 'Login to chat...'}
            disabled={!currentUser}
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !currentUser}
            className="btn-primary px-4"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
