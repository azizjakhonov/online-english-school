import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, Wallet, Check, ArrowLeft,
  Loader2, ShieldCheck, CheckCircle2
} from 'lucide-react';
import api from '../../lib/api';
import { formatUZS } from '../../lib/formatCurrency';

// --- TYPES ---
interface CreditPackage {
  id: number;
  credits: number;
  price_uzs: number;
  label?: string;
  popular?: boolean;
  features: string[];
}

// Prices expressed in UZS (matches backend PACKAGES dict in payments/services.py)
const PACKAGES: CreditPackage[] = [
  {
    id: 1,
    credits: 5,
    price_uzs: 500_000,
    label: 'Starter',
    features: ['Valid for 30 days', 'Basic Support'],
  },
  {
    id: 2,
    credits: 20,
    price_uzs: 1_800_000,
    popular: true,
    features: ['Save 10%', 'Valid for 90 days', 'Priority Support'],
  },
  {
    id: 3,
    credits: 50,
    price_uzs: 4_000_000,
    label: 'Pro',
    features: ['Save 20%', 'Never Expires', 'VIP Support', 'Free Group Class'],
  },
];

export default function BuyCredits() {
  const navigate = useNavigate();

  const [selectedPkg, setSelectedPkg] = useState<number>(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [lastPurchased, setLastPurchased] = useState(0);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await api.get('/api/me/');
        setCurrentBalance(response.data.student_profile?.lesson_credits || 0);
      } catch (err) {
        console.error('Failed to fetch balance', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBalance();
  }, []);

  const handlePurchase = async () => {
    setIsProcessing(true);
    try {
      const pkg = PACKAGES.find(p => p.id === selectedPkg);
      if (!pkg) return;

      const response = await api.post('/api/payments/purchase/', {
        package_id: pkg.id,
      });

      setCurrentBalance(response.data.new_balance);
      setLastPurchased(pkg.credits);
      setShowModal(true);
    } catch (err: unknown) {
      let errorMsg = 'Payment failed. Please try again.';
      if (err && typeof err === 'object' && 'response' in err) {
        const apiError = err as { response?: { data?: { error?: string } } };
        if (apiError.response?.data?.error) {
          errorMsg = apiError.response.data.error;
        }
      }
      alert(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  const selectedPackage = PACKAGES.find(p => p.id === selectedPkg);

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] relative overflow-hidden font-sans">
      {/* Geometric Background */}
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 30-30 30L0 30z' fill='%233b82f6' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E")` }}>
      </div>

      <header className="relative z-10 max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="group flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-bold">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-slate-100">
          <Wallet size={20} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Balance:</span>
          <span className="text-lg font-black text-slate-800">{currentBalance} <span className="text-sm font-medium text-slate-400">Credits</span></span>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pb-20 grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* Left: Package Selection */}
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Buy Credits</h1>
            <p className="text-slate-500 font-medium text-lg">Choose a package that fits your learning goals</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PACKAGES.map(pkg => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPkg(pkg.id)}
                className={`relative cursor-pointer rounded-[32px] border-2 p-8 transition-all duration-300 ${selectedPkg === pkg.id ? 'border-blue-600 bg-white shadow-2xl shadow-blue-100 ring-4 ring-blue-50' : 'border-transparent bg-white hover:border-slate-200'}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-4 right-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-lg shadow-blue-200">
                    Most Popular
                  </div>
                )}

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{pkg.label || 'Standard'}</span>
                    <div className="text-4xl font-black text-slate-800 mt-2">{pkg.credits}</div>
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Credits</div>
                  </div>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedPkg === pkg.id ? 'border-blue-600 bg-blue-600 scale-110 shadow-lg shadow-blue-200' : 'border-slate-200'}`}>
                    {selectedPkg === pkg.id && <Check size={18} className="text-white stroke-[4]" />}
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  {pkg.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm text-slate-600 font-bold">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Check size={12} className="text-emerald-500 stroke-[4]" />
                      </div>
                      {feat}
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-50 pt-6 flex items-baseline justify-between">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                    {formatUZS(Math.round(pkg.price_uzs / pkg.credits))} / credit
                  </span>
                  <span className="text-xl font-black text-blue-600">{formatUZS(pkg.price_uzs)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Summary Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200 border border-slate-100 p-10 sticky top-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">Order Summary</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Secure Checkout</p>
              </div>
            </div>

            <div className="space-y-5 mb-10">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Package</span>
                <span className="text-lg font-black text-slate-800">{selectedPackage?.credits} Credits</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
                <span className="text-lg font-black text-slate-800">{formatUZS(selectedPackage?.price_uzs)}</span>
              </div>
              <div className="h-px bg-dashed border-t border-slate-100 mt-2"></div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-black text-slate-800 uppercase tracking-widest">Total Due</span>
                <span className="text-2xl font-black text-blue-600">{formatUZS(selectedPackage?.price_uzs)}</span>
              </div>
            </div>

            <button
              onClick={handlePurchase}
              disabled={isProcessing}
              className="w-full bg-[#2563eb] hover:bg-blue-700 text-white font-black text-lg py-5 rounded-[24px] shadow-2xl shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  <CreditCard size={22} className="stroke-[3]" /> Pay Now
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-400 font-medium mt-4">
              Demo mode — no real payment required
            </p>
          </div>
        </div>
      </main>

      {/* --- SUCCESS MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-[40px] p-10 max-w-sm w-full shadow-2xl text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={48} className="text-emerald-500" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-3">Success!</h2>
            <p className="text-slate-500 font-medium mb-2 leading-relaxed">
              Successfully added <span className="text-blue-600 font-bold">{lastPurchased} credits</span> to your wallet.
            </p>
            <p className="text-slate-400 text-sm font-medium mb-8">
              Amount: {formatUZS(selectedPackage?.price_uzs)}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all active:scale-[0.95]"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}