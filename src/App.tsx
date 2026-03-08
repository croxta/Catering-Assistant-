import React, { useState, useRef, useEffect } from 'react';
import { 
  Clipboard, 
  Check, 
  Users, 
  Utensils, 
  Calendar, 
  FileText, 
  Camera, 
  Loader2, 
  ArrowRight,
  ChevronLeft,
  Sparkles,
  UtensilsCrossed,
  Copy,
  Zap,
  Moon,
  Sun,
  LogOut,
  History as HistoryIcon,
  LayoutDashboard,
  Download,
  Star,
  User as UserIcon,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { generateOrder, extractMenuText, EventType, GroupProfile, OrderSummary, OrderItem } from './services/geminiService';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading, login, logout } = useAuth();
  
  const [view, setView] = useState<'home' | 'history' | 'admin'>('home');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Architecting...');
  
  // Menu State
  const [menuImages, setMenuImages] = useState<string[]>([]);
  const [ocrText, setOcrText] = useState<string>('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const ocrPromiseRef = useRef<Promise<string> | null>(null);

  // Event State
  const [eventType, setEventType] = useState<EventType>('Corporate');
  const [customEventName, setCustomEventName] = useState('');
  const [groupProfile, setGroupProfile] = useState<GroupProfile>({
    total: 10,
    veg: 5,
    nonVeg: 5,
    jain: 0,
    vegan: 0
  });
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  // Result State
  const [result, setResult] = useState<OrderSummary | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [isCurrentOrderUsed, setIsCurrentOrderUsed] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // History & Admin State
  const [history, setHistory] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Trigger OCR when images change
  useEffect(() => {
    const triggerOcr = async () => {
      if (menuImages.length > 0) {
        await handleBackgroundOcr();
      }
    };
    triggerOcr();
  }, [menuImages.length]);

  // Fetch history when view changes to history
  useEffect(() => {
    if (view === 'history' && user) {
      fetchHistory();
    } else if (view === 'admin' && user?.role === 'admin') {
      fetchAdminStats();
    }
  }, [view, user]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setAdminStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch admin stats", e);
    }
  };

  const handleBackgroundOcr = async () => {
    setIsOcrLoading(true);
    const ocrPromise = extractMenuText(menuImages);
    ocrPromiseRef.current = ocrPromise;
    try {
      const text = await ocrPromise;
      setOcrText(text || '');
      return text || '';
    } catch (error) {
      console.error("OCR Error:", error);
      return '';
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const readers = Array.from(files).map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readers).then(results => {
        setMenuImages(prev => [...prev, ...results]);
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setMenuImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setLoading(true);
    const messages = [
      "Finalizing menu analysis...",
      "Why did the tomato turn red? Because it saw the salad dressing!",
      "Applying special instructions...",
      "What do you call a fake noodle? An impasta!",
      "Identifying dietary-safe options...",
      "Why don't eggs tell jokes? They'd crack each other up!",
      "Calculating portion ratios...",
      "I'm on a seafood diet. I see food and I eat it!",
      "Optimizing for group size...",
      "What do you call a cheese that isn't yours? Nacho cheese!",
      "What's a dessert's favorite pick-up line? 'You're looking sweet today!'",
      "Why did the bread go to the doctor? It was feeling crumby!",
      "What do you call a sad cup of coffee? A depresso.",
      "Why did the chef get arrested? He was caught beating an egg!",
      "What did the sushi say to the bee? Wasabi!",
      "Why did the student eat his homework? Because the teacher said it was a piece of cake!",
      "Finalizing WhatsApp summary..."
    ];
    let msgIdx = 0;
    const interval = setInterval(() => {
      setLoadingMessage(messages[msgIdx % messages.length]);
      msgIdx++;
    }, 2500);

    try {
      let finalMenuData = ocrText;
      if (isOcrLoading && ocrPromiseRef.current) {
        setLoadingMessage("Still reading the menu... (AI is a slow eater!)");
        finalMenuData = await ocrPromiseRef.current;
      }

      const summary = await generateOrder({
        eventType,
        customEventName: eventType === 'Custom' ? customEventName : undefined,
        specialInstructions,
        groupProfile,
        menuData: finalMenuData,
      });
      
      setResult(summary);
      setCheckedItems({});
      
      // Save to backend
      if (user && summary) {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: eventType === 'Custom' ? customEventName : eventType,
            groupProfile,
            result: summary.rawText
          })
        });
        if (res.ok) {
          const savedOrder = await res.json();
          setCurrentOrderId(savedOrder.id);
          setIsCurrentOrderUsed(false);
        }
      }
      
      setStep(5);
    } catch (error) {
      console.error(error);
      alert('Architectural error: Could not process the request.');
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingMessage('Architecting...');
    }
  };

  const toggleOrderUsed = async (orderId: string, used: boolean) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ used })
      });
      if (res.ok) {
        setHistory(prev => prev.map(o => o.id === orderId ? { ...o, used } : o));
        if (orderId === currentOrderId) {
          setIsCurrentOrderUsed(used);
        }
      }
    } catch (e) {
      console.error("Failed to update order", e);
    }
  };

  const rateOrder = async (orderId: string, rating: number) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });
      if (res.ok) {
        setHistory(prev => prev.map(o => o.id === orderId ? { ...o, rating } : o));
      }
    } catch (e) {
      console.error("Failed to rate order", e);
    }
  };

  const toggleItemCheck = (itemName: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const getWhatsAppMessage = () => {
    if (!result) return '';
    
    const selectedItems = result.items.filter(item => checkedItems[item.name]);
    if (selectedItems.length === 0) return 'No items selected.';

    let message = `*ARCHITECT'S PLAN: ${result.eventInfo.toUpperCase()}*\n\n`;
    message += `"${result.personaIntro}"\n\n`;

    const categories = ['Starter', 'Main', 'Dessert', 'Side', 'Other'];
    categories.forEach(category => {
      const items = selectedItems.filter(i => i.category === category);
      if (items.length > 0) {
        message += `*${category.toUpperCase()}S*\n`;
        items.forEach(item => {
          const tags = item.dietaryTags.length > 0 ? ` [${item.dietaryTags.join(', ')}]` : '';
          message += `• ${item.quantity} x ${item.name}${tags}\n`;
        });
        message += '\n';
      }
    });

    message += `*Architect's Notes:*\n${result.serverNotes}\n\n`;
    message += `_Logistics verified by Ultimate Event Architect_`;
    
    return message;
  };

  const saveFinalOrder = async () => {
    if (!currentOrderId || !result) return;
    
    const selectedItems = result.items.filter(item => checkedItems[item.name]);
    if (selectedItems.length === 0) {
      alert('Please select at least one item to save.');
      return;
    }
    
    const finalOrderText = selectedItems.map(item => `${item.quantity} x ${item.name}`).join(', ');
    
    try {
      const res = await fetch(`/api/orders/${currentOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalOrder: finalOrderText })
      });
      if (res.ok) {
        alert('Final order saved to database!');
        setHistory(prev => prev.map(o => o.id === currentOrderId ? { ...o, finalOrder: finalOrderText } : o));
      }
    } catch (e) {
      console.error("Failed to save final order", e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateProfile = (key: keyof GroupProfile, val: number) => {
    setGroupProfile(prev => ({ ...prev, [key]: val }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="architect-card p-10 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-indigo-200">
            <Zap className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold mb-2">Testing Mode.</h1>
          <p className="text-slate-500 mb-8">Google/Apple login is temporarily disabled for Netlify deployment testing.</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => login('himrock77@gmail.com', 'Admin User', 'https://picsum.photos/seed/admin/100')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-200"
            >
              Enter App (Admin Mode)
            </button>
            <button 
              onClick={() => login('user@example.com', 'Regular User', 'https://picsum.photos/seed/user/100')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-medium"
            >
              Enter App (User Mode)
            </button>
          </div>
          
          <p className="mt-8 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            Secure Authentication by Event Architect
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-[var(--bg)]">
      {/* Navigation Bar */}
      <nav className="w-full max-w-4xl flex items-center justify-between mb-12 p-4 architect-card rounded-2xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView('home')}
            className={`p-2 rounded-xl transition-all ${view === 'home' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Zap className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setView('history')}
            className={`p-2 rounded-xl transition-all ${view === 'history' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <HistoryIcon className="w-5 h-5" />
          </button>
          {user.role === 'admin' && (
            <button 
              onClick={() => setView('admin')}
              className={`p-2 rounded-xl transition-all ${view === 'admin' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold">{user.name}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{user.role}</p>
            </div>
            <img src={user.picture} className="w-8 h-8 rounded-full border border-slate-200" alt={user.name} />
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Header */}
              <header className="w-full mb-12 text-center">
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4"
                >
                  <Zap className="w-3 h-3" />
                  Ultimate Event Architect
                </motion.div>
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-[var(--text)] mb-4">
                  The Perfect Order.
                </h1>
                <p className="text-slate-500 font-sans max-w-md mx-auto">
                  Logistics and hospitality intelligence. Capture the menu, define the group, and get the plan.
                </p>
              </header>

              <AnimatePresence mode="wait">
                {/* Step 1: Menu Capture */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="architect-card p-8"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                        <Utensils className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Capture Menu</h2>
                        <p className="text-sm text-slate-500">Snap or upload all menu pages.</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-2xl transition-all"
                        >
                          <FileText className="w-8 h-8 text-slate-400" />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Upload Photo</span>
                        </button>
                        
                        <button 
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-2xl transition-all"
                        >
                          <Camera className="w-8 h-8 text-slate-400" />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Click Photo</span>
                        </button>
                      </div>

                      <AnimatePresence>
                        {menuImages.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-3 gap-3"
                          >
                            {menuImages.map((img, idx) => (
                              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                <img src={img} className="w-full h-full object-cover" alt={`Page ${idx + 1}`} />
                                <button 
                                  onClick={() => removeImage(idx)}
                                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                >
                                  <UtensilsCrossed className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
                      <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload} />
                    </div>

                    <div className="mt-8 flex justify-end items-center gap-4">
                      {isOcrLoading && (
                        <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Analyzing menu in background...
                        </div>
                      )}
                      <button 
                        onClick={() => setStep(2)} 
                        disabled={menuImages.length === 0}
                        className="architect-button flex items-center gap-2"
                      >
                        Next Step <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Event Type */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="architect-card p-8"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <button onClick={() => setStep(1)} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Event Type</h2>
                        <p className="text-sm text-slate-500">How should I approach this logistics plan?</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { id: 'Corporate', title: 'Corporate / CFO Dinner', desc: 'Polished, ROI-focused, and efficient.', icon: '💼' },
                        { id: 'Friends', title: 'Friends / Casual', desc: 'Warm, savvy, and fun planner vibes.', icon: '🍕' },
                        { id: 'Cultural', title: 'Cultural / Religious', desc: 'Meticulous traditions and dietary sanctity.', icon: '🕉️' },
                        { id: 'Custom', title: 'Custom Event', desc: 'Define your own special occasion.', icon: '✨' }
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setEventType(type.id as EventType)}
                          className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                            eventType === type.id 
                              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20' 
                              : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="text-2xl">{type.icon}</span>
                          <div className="flex-1">
                            <h3 className="font-bold">{type.title}</h3>
                            <p className="text-xs text-slate-500">{type.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    <AnimatePresence>
                      {eventType === 'Custom' && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 overflow-hidden"
                        >
                          <div className="input-group">
                            <label className="input-label">Event Name</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Yacht Party, Retirement Brunch..."
                              value={customEventName}
                              onChange={(e) => setCustomEventName(e.target.value)}
                              className="architect-input"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mt-8 flex justify-end">
                      <button 
                        onClick={() => setStep(3)} 
                        disabled={eventType === 'Custom' && !customEventName}
                        className="architect-button flex items-center gap-2"
                      >
                        Next Step <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Group Profile */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="architect-card p-8"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <button onClick={() => setStep(2)} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Group Profile</h2>
                        <p className="text-sm text-slate-500">Who are we feeding today?</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="input-group">
                        <label className="input-label">Total Guests</label>
                        <input 
                          type="number" 
                          value={groupProfile.total} 
                          onChange={(e) => updateProfile('total', parseInt(e.target.value) || 0)}
                          className="architect-input text-lg font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="input-group">
                          <label className="input-label">Veg Only</label>
                          <input type="number" value={groupProfile.veg} onChange={(e) => updateProfile('veg', parseInt(e.target.value) || 0)} className="architect-input" />
                        </div>
                        <div className="input-group">
                          <label className="input-label">Non-Veg</label>
                          <input type="number" value={groupProfile.nonVeg} onChange={(e) => updateProfile('nonVeg', parseInt(e.target.value) || 0)} className="architect-input" />
                        </div>
                        <div className="input-group">
                          <label className="input-label">Jain (No Root Veg)</label>
                          <input type="number" value={groupProfile.jain} onChange={(e) => updateProfile('jain', parseInt(e.target.value) || 0)} className="architect-input" />
                        </div>
                        <div className="input-group">
                          <label className="input-label">Vegan</label>
                          <input type="number" value={groupProfile.vegan} onChange={(e) => updateProfile('vegan', parseInt(e.target.value) || 0)} className="architect-input" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                      <button onClick={() => setStep(4)} className="architect-button flex items-center gap-2">
                        Next Step <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Special Instructions */}
                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="architect-card p-8"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <button onClick={() => setStep(3)} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Preferences</h2>
                        <p className="text-sm text-slate-500">Any specific food types to avoid or prioritize?</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="input-group">
                        <label className="input-label">Special Instructions / Preferences</label>
                        <textarea 
                          placeholder="E.g. Avoid mushrooms, prioritize spicy dishes, include extra sides for kids..."
                          className="architect-input min-h-[150px] resize-none border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10"
                          value={specialInstructions}
                          onChange={(e) => setSpecialInstructions(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                      <button 
                        onClick={handleGenerate} 
                        disabled={loading}
                        className="architect-button flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {loadingMessage}
                          </>
                        ) : (
                          <>
                            Generate Order <Sparkles className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 5: Result */}
                {step === 5 && result && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="architect-card p-8"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                          <Check className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black tracking-tight">ARCHITECT'S PLAN</h2>
                          <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">{result.eventInfo}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setStep(1);
                          setMenuImages([]);
                          setOcrText('');
                        }} 
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        Start Over
                      </button>
                    </div>

                    <div className="mb-8 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 italic text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                      "{result.personaIntro}"
                    </div>

                    <div className="space-y-8">
                      {['Starter', 'Main', 'Dessert', 'Side', 'Other'].map(category => {
                        const items = result.items.filter(i => i.category === category);
                        if (items.length === 0) return null;

                        return (
                          <div key={category} className="space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                              <span className="w-8 h-[1px] bg-slate-200 dark:bg-slate-800"></span>
                              {category}S
                              <span className="flex-1 h-[1px] bg-slate-200 dark:bg-slate-800"></span>
                            </h3>
                            <div className="grid gap-3">
                              {items.map((item, idx) => (
                                <motion.div 
                                  key={idx}
                                  whileHover={{ x: 4 }}
                                  onClick={() => toggleItemCheck(item.name)}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                    checkedItems[item.name] 
                                      ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50' 
                                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800'
                                  }`}
                                >
                                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                    checkedItems[item.name]
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : 'border-slate-200 dark:border-slate-700'
                                  }`}>
                                    {checkedItems[item.name] && <Check className="w-4 h-4" />}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className={`font-bold ${checkedItems[item.name] ? 'text-slate-400 line-through' : ''}`}>
                                        {item.quantity} x {item.name}
                                      </span>
                                      <div className="flex gap-1">
                                        {item.dietaryTags.map(tag => (
                                          <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[8px] font-black uppercase tracking-tighter">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-8 p-6 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                      <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Architect's Notes</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {result.serverNotes}
                      </p>
                    </div>

                    {currentOrderId && (
                      <div className="mt-8 flex items-center justify-center">
                        <label className="flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all group">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            isCurrentOrderUsed
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-200 dark:border-slate-700 group-hover:border-indigo-400'
                          }`}>
                            {isCurrentOrderUsed && <Check className="w-4 h-4" />}
                          </div>
                          <input 
                            type="checkbox" 
                            checked={isCurrentOrderUsed} 
                            onChange={(e) => toggleOrderUsed(currentOrderId, e.target.checked)}
                            className="hidden"
                          />
                          <span className="text-sm font-bold">I used this recommended order</span>
                        </label>
                      </div>
                    )}

                    <div className="mt-8 flex flex-col gap-3">
                      <button 
                        onClick={() => copyToClipboard(getWhatsAppMessage())}
                        className="architect-button flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        {copied ? 'Copied to Clipboard!' : 'Copy Selected for WhatsApp'}
                      </button>
                      
                      <button 
                        onClick={saveFinalOrder}
                        className="architect-button flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Save className="w-4 h-4" /> Save Final Order to DB
                      </button>
                      
                      <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                        Logistics verified by Ultimate Event Architect
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <HistoryIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Order History</h2>
                  <p className="text-sm text-slate-500">Your past architectural masterpieces.</p>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="architect-card p-12 text-center">
                  <p className="text-slate-500">No orders yet. Start architecting!</p>
                </div>
              ) : (
                history.map((order) => (
                  <div key={order.id} className="architect-card p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{order.eventType}</h3>
                          {order.used && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">Used</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={order.used} 
                            onChange={(e) => toggleOrderUsed(order.id, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Used?
                        </label>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800">
                      {order.result}
                    </div>

                    {order.finalOrder && (
                      <div className="mt-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Final Order Saved</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{order.finalOrder}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button 
                            key={star}
                            onClick={() => rateOrder(order.id, star)}
                            className={`p-1 transition-all ${order.rating >= star ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-200'}`}
                          >
                            <Star className={`w-4 h-4 ${order.rating >= star ? 'fill-current' : ''}`} />
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => copyToClipboard(order.result)}
                        className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy Again
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {view === 'admin' && user.role === 'admin' && (
            <motion.div
              key="admin-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Admin Panel</h2>
                    <p className="text-sm text-slate-500">System performance and user metrics.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a 
                    href="/api/admin/users/download" 
                    className="architect-button flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-[10px] py-2 px-3"
                  >
                    <Users className="w-3 h-3" /> Users CSV
                  </a>
                  <a 
                    href="/api/admin/orders/download" 
                    className="architect-button flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-[10px] py-2 px-3"
                  >
                    <HistoryIcon className="w-3 h-3" /> Orders CSV
                  </a>
                </div>
              </div>

              {adminStats ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="architect-card p-4 text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Total Users</p>
                      <p className="text-2xl font-serif font-bold">{adminStats.totalUsers}</p>
                    </div>
                    <div className="architect-card p-4 text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Total Orders</p>
                      <p className="text-2xl font-serif font-bold">{adminStats.totalOrders}</p>
                    </div>
                    <div className="architect-card p-4 text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Avg Rating</p>
                      <p className="text-2xl font-serif font-bold">
                        {(adminStats.orders.reduce((acc: number, o: any) => acc + (o.rating || 0), 0) / (adminStats.orders.filter((o: any) => o.rating).length || 1)).toFixed(1)}
                      </p>
                    </div>
                    <div className="architect-card p-4 text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Usage Rate</p>
                      <p className="text-2xl font-serif font-bold">
                        {((adminStats.orders.filter((o: any) => o.used).length / (adminStats.orders.length || 1)) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="architect-card p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-6">User Signups (Last 7 Days)</h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={(() => {
                            const last7Days = [...Array(7)].map((_, i) => {
                              const d = new Date();
                              d.setDate(d.getDate() - i);
                              return d.toISOString().split('T')[0];
                            }).reverse();
                            
                            return last7Days.map(date => ({
                              date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                              count: adminStats.users.filter((u: any) => u.createdAt.startsWith(date)).length
                            }));
                          })()}
                        >
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} 
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} 
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                              fontSize: '12px'
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#4f46e5" 
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                            strokeWidth={3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="architect-card overflow-hidden">
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-widest">Recent Users</h3>
                        <Users className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                        {adminStats.users.slice().reverse().map((u: any) => (
                          <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <img src={u.picture} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700" alt="" />
                              <div>
                                <p className="text-sm font-bold">{u.name}</p>
                                <p className="text-[10px] text-slate-500">{u.email}</p>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="architect-card overflow-hidden">
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-widest">Recent Orders</h3>
                        <HistoryIcon className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                        {adminStats.orders.slice().reverse().map((o: any) => (
                          <div key={o.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold">{o.eventType}</p>
                                {o.used && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold uppercase">Used</span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500">{o.groupProfile.total} people</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleDateString()}</p>
                              {o.rating && (
                                <div className="flex items-center justify-end gap-1 mt-1">
                                  <Star className="w-2 h-2 fill-yellow-400 text-yellow-400" />
                                  <span className="text-[10px] font-bold">{o.rating}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Decoration */}
      <footer className="mt-12 text-slate-400 flex items-center gap-4">
        <div className="h-px w-12 bg-slate-200 dark:bg-slate-800" />
        <UtensilsCrossed className="w-4 h-4 opacity-20" />
        <div className="h-px w-12 bg-slate-200 dark:bg-slate-800" />
      </footer>
    </div>
  );
}
