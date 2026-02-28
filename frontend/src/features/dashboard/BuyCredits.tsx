import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard, Wallet, Check, ArrowLeft,
  Loader2, ShieldCheck, CheckCircle2, XCircle
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
  const [searchParams] = useSearchParams();

  const [selectedPkg, setSelectedPkg] = useState<number>(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [lastPurchased, setLastPurchased] = useState(0);
  const [paymentCancelled, setPaymentCancelled] = useState(false);

  // Fetch balance on mount, and handle Stripe redirect callbacks (?payment=success/cancel)
  useEffect(() => {
    const paymentParam = searchParams.get('payment');

    const init = async () => {
      try {
        const response = await api.get('/api/me/');
        const sp = response.data.student_profile;
        setCurrentBalance(sp?.available_credits ?? sp?.lesson_credits ?? 0);
      } catch (err) {
        console.error('Failed to fetch balance', err);
      } finally {
        setIsLoading(false);
      }

      if (paymentParam === 'success') {
        // Retrieve package info stored before redirecting to Stripe
        const stored = sessionStorage.getItem('pendingPurchasePkg');
        const storedPkg = stored ? JSON.parse(stored) : null;
        sessionStorage.removeItem('pendingPurchasePkg');
        setLastPurchased(storedPkg?.credits ?? 0);
        setShowModal(true);
      } else if (paymentParam === 'cancel') {
        setPaymentCancelled(true);
      }
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePurchase = async () => {
    setIsProcessing(true);
    setPaymentCancelled(false);
    try {
      const pkg = PACKAGES.find(p => p.id === selectedPkg);
      if (!pkg) return;

      const response = await api.post('/api/payments/purchase/', {
        package_id: pkg.id,
      });

      if (response.data.checkoutUrl) {
        // Stripe flow: save package info for the return trip, then redirect
        sessionStorage.setItem('pendingPurchasePkg', JSON.stringify({ id: pkg.id, credits: pkg.credits }));
        window.location.href = response.data.checkoutUrl;
        return; // page is leaving — don't reset isProcessing
      }

      // Demo / test flow: credits granted immediately
      const meRes = await api.get('/api/me/');
      const sp = meRes.data.student_profile;
      setCurrentBalance(sp?.available_credits ?? sp?.lesson_credits ?? response.data.new_balance ?? 0);
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={36} />
      </div>
    );
  }

  const selectedPackage = PACKAGES.find(p => p.id === selectedPkg);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Back to dashboard"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl text-blue-600 shrink-0">
            <Wallet size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Buy Credits</h1>
            <p className="text-xs text-slate-500 font-medium">Balance: {currentBalance} credits</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
            <span className="text-sm font-bold text-slate-700">{currentBalance}</span>
            <span className="text-xs text-slate-500 font-medium">Credits</span>
          </div>
        </div>
      </header>

      {/* Cancellation notice */}
      {paymentCancelled && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <XCircle size={18} className="text-amber-500 shrink-0" />
            <p className="text-sm font-medium text-amber-700 flex-1">
              Payment was cancelled — no charge was made. Choose a package and try again when you're ready.
            </p>
            <button
              onClick={() => setPaymentCancelled(false)}
              className="text-amber-500 hover:text-amber-700 text-lg leading-none font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: Package Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">Choose a package</h2>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Fits your learning goals</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PACKAGES.map(pkg => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPkg(pkg.id)}
                className={`relative cursor-pointer rounded-2xl border-2 p-5 bg-white shadow-sm transition-all ${selectedPkg === pkg.id ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-2.5 right-4 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Popular
                  </div>
                )}

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{pkg.label || 'Standard'}</span>
                    <div className="text-2xl font-black text-slate-900 mt-1">{pkg.credits}</div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Credits</div>
                  </div>
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedPkg === pkg.id ? 'border-blue-600 bg-blue-600' : 'border-slate-200'}`}>
                    {selectedPkg === pkg.id && <Check size={14} className="text-white stroke-[3]" />}
                  </div>
                </div>

                <div className="space-y-2 mb-5">
                  {pkg.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-emerald-600 stroke-[3]" />
                      </div>
                      {feat}
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-4 flex items-baseline justify-between">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    {formatUZS(Math.round(pkg.price_uzs / pkg.credits))} / credit
                  </span>
                  <span className="text-lg font-black text-blue-600">{formatUZS(pkg.price_uzs)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Summary Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-xl text-blue-600 shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Order Summary</h3>
                <p className="text-xs text-slate-500 font-medium">Secure checkout</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Package</span>
                <span className="text-base font-black text-slate-900">{selectedPackage?.credits} Credits</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subtotal</span>
                <span className="text-base font-black text-slate-900">{formatUZS(selectedPackage?.price_uzs)}</span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Total Due</span>
                <span className="text-xl font-black text-blue-600">{formatUZS(selectedPackage?.price_uzs)}</span>
              </div>
            </div>

            <button
              onClick={handlePurchase}
              disabled={isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <CreditCard size={18} className="stroke-[2.5]" /> Pay Now
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500 font-medium mt-3">
              Powered by Stripe · 256-bit SSL
            </p>
          </div>
        </div>
      </main>

      {/* Success modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Payment Successful!</h2>
            {lastPurchased > 0 ? (
              <p className="text-slate-500 text-sm font-medium mb-1">
                Added <span className="text-blue-600 font-bold">{lastPurchased} credits</span> to your wallet.
              </p>
            ) : (
              <p className="text-slate-500 text-sm font-medium mb-1">
                Your credits will appear in your wallet shortly.
              </p>
            )}
            <p className="text-slate-400 text-xs font-medium mb-6">
              New balance: <span className="font-bold text-slate-600">{currentBalance}</span> credits
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
