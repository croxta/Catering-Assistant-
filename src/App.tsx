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
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateOrder, extractMenuText, EventType, GroupProfile } from './services/geminiService';

export default function App() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Architecting...');
  
  // Menu State
  const [menuImages, setMenuImages] = useState<string[]>([]);
  const [ocrText, setOcrText] = useState<string>('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);

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
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Trigger OCR when images change
  useEffect(() => {
    if (menuImages.length > 0 && !isOcrLoading) {
      handleBackgroundOcr();
    }
  }, [menuImages.length]);

  const handleBackgroundOcr = async () => {
    setIsOcrLoading(true);
    try {
      const text = await extractMenuText(menuImages);
      setOcrText(text || '');
    } catch (error) {
      console.error("OCR Error:", error);
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
      "Applying special instructions...",
      "Identifying dietary-safe options...",
      "Calculating portion ratios...",
      "Optimizing for group size...",
      "Finalizing WhatsApp summary..."
    ];
    let msgIdx = 0;
    const interval = setInterval(() => {
      setLoadingMessage(messages[msgIdx % messages.length]);
      msgIdx++;
    }, 2000);

    try {
      // If OCR is still running, wait for it
      let finalMenuData = ocrText;
      if (isOcrLoading) {
        setLoadingMessage("Waiting for menu analysis to complete...");
        // Simple polling for demo purposes, in real app use a promise
        while (isOcrLoading) {
          await new Promise(r => setTimeout(r, 500));
        }
        finalMenuData = ocrText;
      }

      const summary = await generateOrder({
        eventType,
        customEventName: eventType === 'Custom' ? customEventName : undefined,
        specialInstructions,
        groupProfile,
        menuData: finalMenuData,
      });
      setResult(summary || 'Failed to generate summary.');
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

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const updateProfile = (key: keyof GroupProfile, val: number) => {
    setGroupProfile(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">
      {/* Header */}
      <header className="w-full max-w-2xl mb-12 text-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-4"
        >
          <Zap className="w-3 h-3" />
          Ultimate Event Architect
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-4">
          The Perfect Order.
        </h1>
        <p className="text-slate-500 font-sans max-w-md mx-auto">
          Logistics and hospitality intelligence. Capture the menu, define the group, and get the plan.
        </p>
      </header>

      <main className="w-full max-w-2xl">
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
                    className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl transition-all"
                  >
                    <FileText className="w-8 h-8 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600">Upload Photo</span>
                  </button>
                  
                  <button 
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl transition-all"
                  >
                    <Camera className="w-8 h-8 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600">Click Photo</span>
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
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
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

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  multiple
                  onChange={handleImageUpload} 
                />
                <input 
                  type="file" 
                  ref={cameraInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  capture="environment"
                  onChange={handleImageUpload} 
                />
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
                <button onClick={() => setStep(1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors">
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
                        ? 'border-indigo-600 bg-indigo-50/50' 
                        : 'border-slate-100 hover:border-slate-200'
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
                <button onClick={() => setStep(2)} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors">
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
                    <input 
                      type="number" 
                      value={groupProfile.veg} 
                      onChange={(e) => updateProfile('veg', parseInt(e.target.value) || 0)}
                      className="architect-input"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Non-Veg</label>
                    <input 
                      type="number" 
                      value={groupProfile.nonVeg} 
                      onChange={(e) => updateProfile('nonVeg', parseInt(e.target.value) || 0)}
                      className="architect-input"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Jain (No Root Veg)</label>
                    <input 
                      type="number" 
                      value={groupProfile.jain} 
                      onChange={(e) => updateProfile('jain', parseInt(e.target.value) || 0)}
                      className="architect-input"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Vegan</label>
                    <input 
                      type="number" 
                      value={groupProfile.vegan} 
                      onChange={(e) => updateProfile('vegan', parseInt(e.target.value) || 0)}
                      className="architect-input"
                    />
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
                <button onClick={() => setStep(3)} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors">
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
                    className="architect-input min-h-[150px] resize-none border-indigo-100 bg-indigo-50/30"
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
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="architect-card p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Order Architected</h2>
                    <p className="text-sm text-slate-500">Ready for your group chat.</p>
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

              <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl font-mono text-sm leading-relaxed whitespace-pre-wrap relative group">
                {result}
                <button 
                  onClick={copyToClipboard}
                  className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button 
                  onClick={copyToClipboard}
                  className="architect-button flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {copied ? 'Copied to Clipboard!' : 'Copy for WhatsApp'}
                </button>
                <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  Logistics verified by Ultimate Event Architect
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Decoration */}
      <footer className="mt-12 text-slate-400 flex items-center gap-4">
        <div className="h-px w-12 bg-slate-200" />
        <UtensilsCrossed className="w-4 h-4 opacity-20" />
        <div className="h-px w-12 bg-slate-200" />
      </footer>
    </div>
  );
}
