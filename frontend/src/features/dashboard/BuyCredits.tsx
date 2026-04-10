import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wallet, Check, Loader2, ShieldCheck, CheckCircle2,
  XCircle, Tag, ArrowLeft, ArrowRight, Package, CreditCard,
  Zap, Star,
} from 'lucide-react';
import api from '../../lib/api';
import { formatUZS } from '../../lib/formatCurrency';
import { usePageTitle } from '../../lib/usePageTitle';
import { useAuth } from '../auth/AuthContext';
import Avatar from '../../components/Avatar';
import clickLogoImg from '../../../Click-01.png';
import paymeLogoImg from '../../../Paymeuz_logo.png';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditPackage {
  id: number;
  name: string;
  credits: number;
  price_uzs: number;
  is_popular: boolean;
  features: string[];
  validity_label: string;
  discount_percent: number;
  price_per_credit_uzs: number;
}

interface DiscountResult {
  code: string;
  discount_type: 'percent' | 'fixed' | 'free_credits';
  discount_value: number;
  discount_amount: number;
  free_credits: number;
}

type PaymentProvider = 'payme' | 'click' | 'stripe';

// ─── Stripe Logo ──────────────────────────────────────────────────────────────

function StripeLogo() {
  return (
    <svg viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: 22, width: 'auto' }}>
      <text x="0" y="21" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="24" fill="#635BFF">stripe</text>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BuyCredits() {
  usePageTitle('Buy Credits');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [pkgsLoading, setPkgsLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<number>(0);
  const [provider, setProvider] = useState<PaymentProvider>('payme');

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);

  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountResult | null>(null);

  useEffect(() => {
    api.get('/api/payments/packages/')
      .then(res => {
        const pkgs: CreditPackage[] = res.data;
        setPackages(pkgs);
        const popular = pkgs.find(p => p.is_popular);
        setSelectedPkg(popular?.id ?? pkgs[0]?.id ?? 0);
      })
      .catch(() => setPackages([]))
      .finally(() => setPkgsLoading(false));
  }, []);

  const selectedPackage = packages.find(p => p.id === selectedPkg);
  const basePrice = selectedPackage?.price_uzs ?? 0;
  const discountedPrice = appliedDiscount
    ? Math.max(0, basePrice - appliedDiscount.discount_amount)
    : basePrice;

  useEffect(() => {
    const paymentParam = searchParams.get('payment');
    const init = async () => {
      try {
        const res = await api.get('/api/me/');
        const sp = res.data.student_profile;
        setCurrentBalance(sp?.available_credits ?? sp?.lesson_credits ?? 0);
      } catch { /* ignore */ }
      finally { setIsLoading(false); }

      if (paymentParam === 'success') {
        sessionStorage.removeItem('pendingPurchasePkg');
        setShowModal(true);
      } else if (paymentParam === 'cancel') {
        setPaymentCancelled(true);
      }
    };
    init();
  }, [searchParams]);

  const handleApplyPromo = useCallback(async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const pkg = packages.find(p => p.id === selectedPkg);
    if (!pkg) return;
    setPromoLoading(true);
    setPromoError('');
    setAppliedDiscount(null);
    try {
      const res = await api.post('/api/marketing/discount-codes/validate/', { code, amount: pkg.price_uzs });
      setAppliedDiscount(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setPromoError(e?.response?.data?.error ?? 'Invalid discount code.');
    } finally {
      setPromoLoading(false);
    }
  }, [promoInput, selectedPkg, packages]);

  const handlePurchase = async () => {
    const pkg = packages.find(p => p.id === selectedPkg);
    if (!pkg) return;
    setIsProcessing(true);
    setPaymentCancelled(false);
    try {
      const body: Record<string, unknown> = { package_id: pkg.id, provider };
      if (appliedDiscount) body.discount_code = appliedDiscount.code;

      const response = await api.post('/api/payments/initiate/', body);
      const checkoutUrl = response.data.checkout_url as string;

      if (!checkoutUrl) {
        const meRes = await api.get('/api/me/');
        const sp = meRes.data.student_profile;
        setCurrentBalance(sp?.available_credits ?? sp?.lesson_credits ?? response.data.new_balance ?? 0);
        setShowModal(true);
        return;
      }
      sessionStorage.setItem('pendingPurchasePkg', JSON.stringify({ id: pkg.id, credits: pkg.credits }));
      window.location.href = checkoutUrl;
    } catch (err: unknown) {
      let msg = 'Payment failed. Please try again.';
      const e = err as { response?: { data?: { error?: string } } };
      if (e?.response?.data?.error) msg = e.response.data.error;
      alert(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || pkgsLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: '#2563eb' }} />
      </div>
    );
  }

  const providers: { id: PaymentProvider; label: string; sub: string; logo: React.ReactNode }[] = [
    {
      id: 'payme', label: 'PayMe', sub: 'Wallet or linked Uzcard / Humo',
      logo: <img src={paymeLogoImg} alt="PayMe" style={{ height: 32, width: 'auto', objectFit: 'contain', display: 'block' }} />,
    },
    {
      id: 'click', label: 'Click', sub: 'Instant via Click mobile app',
      logo: <img src={clickLogoImg} alt="Click" style={{ height: 32, width: 'auto', objectFit: 'contain', display: 'block' }} />,
    },
    {
      id: 'stripe', label: 'Stripe', sub: 'Visa, Mastercard, Google Pay, Apple Pay',
      logo: <StripeLogo />,
    },
  ];

  const pkgDiscountAmount = selectedPackage && selectedPackage.discount_percent > 0
    ? Math.round(basePrice / (1 - selectedPackage.discount_percent / 100) - basePrice)
    : 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: '#111827',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        gap: 12,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#374151', borderRadius: 8,
            padding: 0, flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>Buy Credits</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Top up your balance and book lessons</div>
        </div>

        {/* Balance chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          borderRadius: 20,
          padding: '7px 14px', flexShrink: 0,
        }}>
          <Wallet size={13} style={{ color: 'rgba(255,255,255,0.8)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
            {currentBalance} Credits
          </span>
        </div>

        <Avatar url={user?.profile_picture_url} name={user?.full_name ?? 'User'} size={36} />
      </header>

      {/* ── Cancelled Notice ─────────────────────────────────────────────── */}
      {paymentCancelled && (
        <div style={{ margin: '16px 24px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#fffbeb', border: '1px solid #fde68a',
            borderLeft: '4px solid #f59e0b', borderRadius: 10,
            padding: '11px 16px',
          }}>
            <XCircle size={15} style={{ color: '#d97706', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#92400e', flex: 1 }}>
              Payment was cancelled — no charge was made.
            </span>
            <button
              onClick={() => setPaymentCancelled(false)}
              style={{ background: 'none', border: 'none', color: '#d97706', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main style={{
        padding: '20px 24px 40px',
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: 16,
        alignItems: 'start',
        flex: 1,
        maxWidth: 1100,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}>

        {/* ── LEFT COLUMN ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Package Selection ─────────────────────────────────────────── */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            {/* Section header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 36, height: 36,
                background: '#eff6ff',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Package size={16} style={{ color: '#2563eb' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Choose a Package</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Select the credit bundle that fits your needs</div>
              </div>
            </div>

            <div style={{ padding: '18px 20px' }}>
              {packages.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '32px 0', margin: 0 }}>
                  No packages available.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {packages.map(pkg => {
                    const sel = selectedPkg === pkg.id;
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => {
                          setSelectedPkg(pkg.id);
                          setAppliedDiscount(null);
                          setPromoInput('');
                          setPromoError('');
                        }}
                        style={{
                          position: 'relative',
                          border: sel ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
                          borderRadius: 14,
                          cursor: 'pointer',
                          background: sel ? '#eff6ff' : '#fff',
                          overflow: 'hidden',
                          transition: 'all 0.15s',
                          boxShadow: sel ? '0 0 0 3px rgba(37,99,235,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        {/* Popular strip */}
                        {pkg.is_popular && (
                          <div style={{
                            background: '#2563eb',
                            color: '#fff',
                            fontSize: 10, fontWeight: 700,
                            textAlign: 'center',
                            padding: '5px 0',
                            letterSpacing: '0.07em',
                            textTransform: 'uppercase',
                          }}>
                            ★ Most Popular
                          </div>
                        )}

                        {/* Selected check */}
                        {sel && (
                          <div style={{
                            position: 'absolute',
                            top: pkg.is_popular ? 34 : 10,
                            right: 10,
                            width: 20, height: 20,
                            background: '#2563eb', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(37,99,235,0.4)',
                          }}>
                            <Check size={11} style={{ color: '#fff', strokeWidth: 3 }} />
                          </div>
                        )}

                        <div style={{ padding: '14px 16px 18px' }}>
                          {/* Name + discount badge */}
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'flex-start', marginBottom: 10,
                            paddingRight: sel ? 24 : 0,
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {pkg.name}
                            </span>
                            {pkg.discount_percent > 0 && (
                              <span style={{
                                background: '#dcfce7', color: '#15803d',
                                fontSize: 10, fontWeight: 700,
                                padding: '2px 6px', borderRadius: 20,
                                whiteSpace: 'nowrap', flexShrink: 0,
                              }}>
                                -{pkg.discount_percent}%
                              </span>
                            )}
                          </div>

                          {/* Credits hero */}
                          <div style={{ lineHeight: 1, marginBottom: 6 }}>
                            <span style={{
                              fontSize: 44, fontWeight: 900,
                              color: sel ? '#1d4ed8' : '#111827',
                              letterSpacing: '-0.04em',
                            }}>
                              {pkg.credits}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginLeft: 4 }}>
                              credits
                            </span>
                          </div>

                          {/* Price */}
                          <div style={{
                            fontSize: 14, fontWeight: 800,
                            color: sel ? '#2563eb' : '#374151',
                            marginBottom: pkg.features.length > 0 ? 14 : 0,
                          }}>
                            {formatUZS(pkg.price_uzs)}
                          </div>

                          {/* Features */}
                          {pkg.features.length > 0 && (
                            <div style={{
                              borderTop: '1px solid #e5e7eb',
                              paddingTop: 12,
                              display: 'flex', flexDirection: 'column', gap: 7,
                            }}>
                              {pkg.features.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <div style={{
                                    width: 15, height: 15,
                                    background: sel ? '#2563eb' : '#22c55e',
                                    borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                  }}>
                                    <Check size={8} style={{ color: '#fff', strokeWidth: 3.5 }} />
                                  </div>
                                  <span style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{f}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Payment Method ───────────────────────────────────────────── */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 36, height: 36,
                background: '#eff6ff',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <CreditCard size={16} style={{ color: '#2563eb' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Payment Method</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Choose how you'd like to pay</div>
              </div>
            </div>

            <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {providers.map(p => {
                const active = provider === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: active ? '#eff6ff' : '#fafafa',
                      border: active ? '1.5px solid #2563eb' : '1.5px solid #e5e7eb',
                      transition: 'all 0.15s',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    {/* Logo box */}
                    <div style={{
                      width: 88, height: 46, flexShrink: 0,
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 9,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '5px 12px',
                      boxSizing: 'border-box',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      overflow: 'hidden',
                    }}>
                      {p.logo}
                    </div>

                    {/* Label + desc */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700,
                        color: active ? '#1d4ed8' : '#111827',
                        marginBottom: 2,
                      }}>
                        {p.label}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>{p.sub}</div>
                    </div>

                    {/* Radio */}
                    <div style={{
                      width: 18, height: 18, flexShrink: 0,
                      borderRadius: '50%',
                      border: active ? '2px solid #2563eb' : '2px solid #d1d5db',
                      background: active ? '#2563eb' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {active && (
                        <div style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%' }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Why Credits? promo banner ─────────────────────────────────── */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            borderRadius: 16,
            padding: '20px 24px',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 44, height: 44, background: 'rgba(255,255,255,0.15)',
              borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Zap size={22} style={{ color: '#fbbf24' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                1 Credit = 1 Lesson
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                Credits never expire. Use them to book lessons with any teacher on the platform.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {[1, 2, 3].map(i => <Star key={i} size={14} style={{ color: '#fbbf24' }} fill="#fbbf24" />)}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN — Order Summary ─────────────────────────────── */}
        <aside style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          overflow: 'hidden',
          position: 'sticky',
          top: 80,
        }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Order Summary</div>
          </div>

          <div style={{ padding: '18px 20px 22px' }}>

            {/* Selected package card */}
            {selectedPackage ? (
              <div style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                borderRadius: 12,
                padding: '16px 18px',
                marginBottom: 18,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: 'rgba(255,255,255,0.55)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginBottom: 4,
                  }}>
                    {selectedPackage.name}
                  </div>
                  <div style={{ lineHeight: 1 }}>
                    <span style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
                      {selectedPackage.credits}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginLeft: 5 }}>
                      credits
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                    {formatUZS(selectedPackage.price_per_credit_uzs)}/cr
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                    {formatUZS(selectedPackage.price_uzs)}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: '#f9fafb', borderRadius: 12, padding: '16px 18px',
                marginBottom: 18, fontSize: 13, color: '#9ca3af', textAlign: 'center',
              }}>
                No package selected
              </div>
            )}

            {/* Discounts */}
            {(pkgDiscountAmount > 0 || (appliedDiscount && appliedDiscount.discount_amount > 0)) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                {pkgDiscountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>Package Discount</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                      −{formatUZS(pkgDiscountAmount)}
                    </span>
                  </div>
                )}
                {appliedDiscount && appliedDiscount.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
                      Promo ({appliedDiscount.code})
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                      −{formatUZS(appliedDiscount.discount_amount)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Promo Code */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#374151',
                letterSpacing: '0.05em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8,
              }}>
                <Tag size={11} style={{ color: '#2563eb' }} />
                Promo Code
              </div>

              {appliedDiscount ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 9, padding: '9px 12px',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>✓ {appliedDiscount.code}</span>
                  <button
                    onClick={() => { setAppliedDiscount(null); setPromoInput(''); setPromoError(''); }}
                    style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 7 }}>
                  <input
                    value={promoInput}
                    onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleApplyPromo()}
                    placeholder="Enter promo code"
                    style={{
                      flex: 1, padding: '9px 12px', fontSize: 13,
                      border: '1px solid #e5e7eb', borderRadius: 9,
                      outline: 'none', background: '#f9fafb', color: '#111827',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    style={{
                      padding: '9px 14px',
                      background: '#111827', color: '#fff',
                      border: 'none', borderRadius: 9,
                      fontSize: 13, fontWeight: 700,
                      cursor: promoLoading || !promoInput.trim() ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                      opacity: (promoLoading || !promoInput.trim()) ? 0.4 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {promoLoading ? <Loader2 size={13} className="animate-spin" /> : 'Apply'}
                  </button>
                </div>
              )}
              {promoError && (
                <p style={{ fontSize: 11, color: '#dc2626', margin: '5px 0 0' }}>{promoError}</p>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #e5e7eb', margin: '0 0 16px' }} />

            {/* Total */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Total</span>
              <span style={{
                fontSize: 26, fontWeight: 900, color: '#0f172a',
                letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                {formatUZS(discountedPrice)}
              </span>
            </div>

            {/* Pay Now Button */}
            <button
              onClick={handlePurchase}
              disabled={isProcessing || packages.length === 0}
              style={{
                width: '100%', padding: '14px 0',
                background: isProcessing || packages.length === 0
                  ? '#93c5fd'
                  : 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700,
                cursor: isProcessing || packages.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity 0.15s',
                letterSpacing: '0.01em',
                boxShadow: isProcessing || packages.length === 0 ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
              }}
            >
              {isProcessing
                ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
                : <>Pay Now <ArrowRight size={16} /></>
              }
            </button>

            {/* Trust badges */}
            <div style={{
              marginTop: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, fontSize: 11, color: '#9ca3af',
            }}>
              <ShieldCheck size={13} style={{ color: '#22c55e' }} />
              Secure encrypted payment
            </div>

            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <a href="/support" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none' }}>
                Need help? Contact Support
              </a>
            </div>
          </div>
        </aside>
      </main>

      {/* ── Success Modal ────────────────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: 36,
            maxWidth: 360, width: '100%',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              width: 68, height: 68, background: '#f0fdf4', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle2 size={38} style={{ color: '#10b981' }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
              Payment Successful!
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 22px' }}>
              Your credits have been added to your account.
            </p>
            <div style={{
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12,
              padding: '14px 18px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 22,
            }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>New Balance</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>
                {currentBalance} Credits
              </span>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                width: '100%', padding: '13px 0',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                color: '#fff',
                border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
