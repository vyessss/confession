/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  HelpCircle, 
  ShieldCheck, 
  Send, 
  Home, 
  PlusCircle, 
  User,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Share2,
  MoreHorizontal,
  AlertCircle
} from 'lucide-react';
import { getSupabase } from './lib/supabase';

interface Confession {
  id: string | number;
  text: string;
  timestamp: Date;
  likes: number;
  dislikes: number; // Kept for UI, but DB only has 'like'
  userVote: 'like' | 'dislike' | null;
}

export default function App() {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [newConfessionText, setNewConfessionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const MAX_CHARS = 1000;
  const MIN_CHARS = 10;

  // Fetch confessions from Supabase
  const fetchConfessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      
      // Try to fetch with ordering by created_at first
      let { data, error } = await supabase
        .from('message')
        .select('*')
        .order('created_at', { ascending: false });

      // If created_at fails, try without ordering
      if (error) {
        console.warn('Ordering by created_at failed, trying without order:', error);
        const fallback = await supabase.from('message').select('*');
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      if (data) {
        const mapped: Confession[] = data.map((item: any) => ({
          id: item.id || Math.random().toString(),
          text: item.confession || 'Empty whisper...',
          timestamp: item.created_at ? new Date(item.created_at) : new Date(),
          likes: typeof item.like === 'number' ? item.like : 0,
          dislikes: 0,
          userVote: null,
        }));
        setConfessions(mapped);
      }
    } catch (err: any) {
      console.error('Error fetching confessions:', err);
      setError(err.message || 'Failed to load whispers. Check your Supabase credentials and table schema.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfessions();
  }, []);

  const handlePost = async () => {
    if (newConfessionText.length < MIN_CHARS) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('message')
        .insert([{ confession: newConfessionText, like: 0 }])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        const newEntry: Confession = {
          id: data[0].id,
          text: data[0].confession,
          timestamp: data[0].created_at ? new Date(data[0].created_at) : new Date(),
          likes: 0,
          dislikes: 0,
          userVote: null,
        };
        
        setConfessions([newEntry, ...confessions]);
        setIsSubmitting(false);
        setShowSuccess(true);
        setNewConfessionText('');
        
        setTimeout(() => {
          setShowSuccess(false);
          setActiveTab('home');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Error posting confession:', err);
      setError('Failed to post. Check your Supabase table permissions.');
      setIsSubmitting(false);
    }
  };

  const handleVote = async (id: string | number, type: 'like' | 'dislike') => {
    // Only 'like' is supported by the DB schema provided
    if (type === 'dislike') return;

    const target = confessions.find(c => c.id === id);
    if (!target) return;

    const isRemoving = target.userVote === 'like';
    const newLikeCount = isRemoving ? target.likes - 1 : target.likes + 1;

    // Optimistic update
    setConfessions(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { 
        ...c, 
        likes: newLikeCount, 
        userVote: isRemoving ? null : 'like' 
      };
    }));

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('message')
        .update({ like: newLikeCount })
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating vote:', err);
      // Rollback on error
      setConfessions(prev => prev.map(c => {
        if (c.id !== id) return c;
        return { 
          ...c, 
          likes: target.likes, 
          userVote: target.userVote 
        };
      }));
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-gradient-to-b from-background-accent to-background-dark overflow-x-hidden selection:bg-primary/30">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 pt-6 pb-2 sticky top-0 z-40 bg-background-accent/40 backdrop-blur-md">
        <button className="flex size-10 items-center justify-center rounded-full bg-slate-800/40 hover:bg-slate-800/60 transition-colors">
          <X className="size-5 text-slate-100" />
        </button>
        <h2 className="text-lg font-bold tracking-tight text-slate-100">
          {activeTab === 'home' ? 'Whispers' : 'New Confession'}
        </h2>
        {activeTab === 'home' ? (
          <button 
            onClick={fetchConfessions}
            disabled={isLoading}
            className={`flex size-10 items-center justify-center rounded-full bg-slate-800/40 hover:bg-slate-800/60 transition-all ${isLoading ? 'animate-spin opacity-50' : ''}`}
          >
            <motion.div whileTap={{ rotate: 180 }}>
              <PlusCircle className="size-5 text-slate-100 rotate-45" />
            </motion.div>
          </button>
        ) : (
          <button className="flex size-10 items-center justify-center rounded-full bg-slate-800/40 hover:bg-slate-800/60 transition-colors">
            <HelpCircle className="size-5 text-slate-100" />
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex flex-col flex-1 px-4 pt-6 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
            >
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="size-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-slate-500 text-sm animate-pulse">Summoning whispers...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <AlertCircle className="size-10 text-primary/50" />
                  <p className="text-slate-400 text-sm max-w-[200px]">{error}</p>
                  <button 
                    onClick={fetchConfessions}
                    className="text-primary text-xs font-bold uppercase tracking-widest hover:underline"
                  >
                    Try Again
                  </button>
                </div>
              ) : confessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <MessageCircle className="size-10 text-slate-700" />
                  <p className="text-slate-500 text-sm">The void is silent. Be the first to speak.</p>
                </div>
              ) : (
                confessions.map((c) => (
                  <motion.div 
                    layout
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-background-accent/40 border border-white/5 rounded-2xl p-5 flex flex-col gap-4 shadow-lg backdrop-blur-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center">
                          <User className="size-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-300">Anonymous</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{formatTime(c.timestamp)}</span>
                        </div>
                      </div>
                      <button className="text-slate-500 hover:text-slate-300">
                        <MoreHorizontal className="size-5" />
                      </button>
                    </div>
                    
                    <p className="text-slate-200 leading-relaxed text-base">
                      {c.text}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => handleVote(c.id, 'like')}
                          className={`flex items-center gap-1.5 transition-all active:scale-90 ${c.userVote === 'like' ? 'text-primary' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          <ThumbsUp className={`size-5 ${c.userVote === 'like' ? 'fill-primary/20' : ''}`} />
                          <span className="text-sm font-medium">{c.likes}</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <button className="text-slate-500 hover:text-slate-300">
                          <MessageCircle className="size-5" />
                        </button>
                        <button className="text-slate-500 hover:text-slate-300">
                          <Share2 className="size-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'create' && (
            <motion.div 
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-8"
            >
              {!showSuccess ? (
                <>
                  <div className="text-center">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 mb-2">Share Your Secret</h1>
                    <p className="text-slate-400 text-base">Let it out. No one will ever know it was you.</p>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-primary/20 rounded-xl blur opacity-30 group-focus-within:opacity-100 transition duration-500"></div>
                      <textarea 
                        value={newConfessionText}
                        onChange={(e) => setNewConfessionText(e.target.value.slice(0, MAX_CHARS))}
                        className="relative w-full min-h-[320px] rounded-xl border border-primary/20 bg-background-accent/60 p-5 text-lg leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all resize-none" 
                        placeholder="Write your anonymous confession here..."
                      />
                    </div>

                    <div className="flex flex-col items-center gap-6">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <ShieldCheck className="size-4 text-primary" />
                          <span>Your confession is completely anonymous</span>
                        </div>
                        {newConfessionText.length > 0 && newConfessionText.length < MIN_CHARS && (
                          <p className="text-[10px] text-primary/70 animate-pulse">
                            Keep writing... at least {MIN_CHARS} characters needed
                          </p>
                        )}
                      </div>

                      <div className="relative group w-full max-w-xs">
                        <div className={`absolute -inset-1 bg-primary rounded-full blur-md opacity-40 transition duration-300 ${newConfessionText.length >= MIN_CHARS ? 'group-hover:opacity-60' : 'opacity-0'}`}></div>
                        <button 
                          onClick={handlePost}
                          disabled={newConfessionText.length < MIN_CHARS || isSubmitting}
                          className={`relative w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-full flex items-center justify-center gap-2 shadow-xl shadow-primary/20 transition-all active:scale-95`}
                        >
                          {isSubmitting ? (
                            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <span>Post Confession</span>
                              <Send className="size-5" />
                            </>
                          )}
                        </button>
                      </div>

                      <p className={`text-xs uppercase tracking-widest font-semibold transition-colors ${newConfessionText.length >= MAX_CHARS ? 'text-primary' : 'text-slate-500'}`}>
                        {newConfessionText.length} / {MAX_CHARS} CHARACTERS
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center gap-4"
                >
                  <div className="size-20 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="size-10 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Confession Posted</h2>
                  <p className="text-slate-400">Your secret has been released into the void.</p>
                  <button 
                    onClick={() => {
                      setShowSuccess(false);
                      setActiveTab('home');
                    }}
                    className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-colors"
                  >
                    View Whispers
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation Bar (Fixed) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="flex items-center justify-center gap-20 border-t border-primary/10 bg-background-dark/80 backdrop-blur-xl px-6 pb-8 pt-3">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-primary scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Home className={`size-6 ${activeTab === 'home' ? 'fill-primary/20' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Feed</span>
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'create' ? 'text-primary scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <PlusCircle className={`size-8 ${activeTab === 'create' ? 'fill-primary/20' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Secret</span>
          </button>
        </div>
      </nav>

      {/* Decorative Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="fixed bottom-[-5%] right-[-5%] w-80 h-80 bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
    </div>
  );
}
