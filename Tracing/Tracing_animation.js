import React, { useState, useEffect } from 'react';
import { cn } from './cn_helper.js';

/**
 * The 7 Canonical Stages of the Razorpay AP2 / X-402 Autonomous Commerce Pipeline.
 */
export const DEFAULT_EXECUTION_STAGES = [
  {
    id: "stage_1_query",
    stepNumber: 1,
    title: "Query Asked",
    subtitle: "Intent Received & Classified",
    description: 'User initiated voice/text command: "Buy product which costs ₹2000". Smart Router classified as AUTO_NAVIGATION.',
    status: "upcoming", // 'upcoming' | 'current' | 'completed' | 'failed'
    timestamp: null,
    metadata: {
      query: "buy the product which cost 2000",
      intent: "AUTO_NAVIGATION",
      confidence: "0.98 (LLM)"
    }
  },
  {
    id: "stage_2_discovery",
    stepNumber: 2,
    title: "Product Discovery",
    subtitle: "Accessibility Tree & Catalog Matching",
    description: "DOM Accessibility Tree mapped on Port 5000. Matched product: Nike Air Jordan 1 Low (₹1,999 / ₹2,000).",
    status: "upcoming",
    timestamp: null,
    metadata: {
      productId: "shoe_001",
      productName: "Nike Air Jordan 1 Low",
      price: 1999,
      currency: "INR",
      stock: 10
    }
  },
  {
    id: "stage_3_user_consent",
    stepNumber: 3,
    title: "User Consent (HITL)",
    subtitle: "Trusted Consent Surface Evaluation",
    description: "Presented interactive Cart Consent popup on Port 6003. User reviewed item & authorized transaction.",
    status: "upcoming",
    decision: null, // 'accepted' | 'denied'
    timestamp: null,
    metadata: {
      surface: "Trusted Consent Surface Modal",
      userDecision: "Accepted & Authorized",
      authorizedAmount: "₹1,999 INR"
    }
  },
  {
    id: "stage_4_acp_mandate",
    stepNumber: 4,
    title: "Created ACP Mandate",
    subtitle: "Cart Mandate Cryptographically Signed",
    description: "Locked merchant catalog items and generated tamper-proof Cart Mandate with HMAC-SHA256 signature.",
    status: "upcoming",
    timestamp: null,
    metadata: {
      mandateType: "cart_mandate",
      mandateId: "man_cart_8921_3f9a",
      merchantId: "merchant_acp_razorpay_001",
      signature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  },
  {
    id: "stage_5_ap2_x402",
    stepNumber: 5,
    title: "AP2 Mandate & X-402 Handshake",
    subtitle: "Payment Mandate Linked & HTTP 402 Issued",
    description: "Chained Payment Mandate to Cart Mandate. X-402 Gateway responded with HTTP 402 challenge & single-use nonce.",
    status: "upcoming",
    timestamp: null,
    metadata: {
      paymentMandateId: "man_pay_9041_7c2b",
      httpStatus: 402,
      orderRef: "order_ref_17884092_61fa",
      nonce: "d41d8cd98f00b204e9800998ecf8427e",
      razorpayOrderId: "order_rzp_live_8820"
    }
  },
  {
    id: "stage_6_razorpay_payment",
    stepNumber: 6,
    title: "Razorpay Payment (HITL)",
    subtitle: "Settlement Proof & Signature Generation",
    description: "Standard Checkout executed. Generated cryptographically verifiable payment proof & HMAC payment signature.",
    status: "upcoming",
    decision: null, // 'payment_done' | 'rejected'
    timestamp: null,
    metadata: {
      paymentStatus: "Payment Done",
      paymentId: "pay_live_9921_8fa2",
      signatureVerified: true
    }
  },
  {
    id: "stage_7_order_confirmed",
    stepNumber: 7,
    title: "Order Confirmed",
    subtitle: "Replay Protected & Settlement Finalized",
    description: "X-402 Gateway verified signature in constant time, marked nonce as consumed, and locked order as confirmed.",
    status: "upcoming",
    timestamp: null,
    metadata: {
      finalStatus: "confirmed",
      settlementTime: "0.42s",
      receiptId: "rcpt_ap2_x402_success"
    }
  }
];

const LINE_LEFT = 20; // px offset for vertical line and circle alignment

/**
 * Main Tracing Visualizer Component.
 */
export function TrackingTimeline({ stages = DEFAULT_EXECUTION_STAGES, onReset, activeStageIndex = 0 }) {
  const [currentStages, setCurrentStages] = useState(stages);
  const [expandedStageId, setExpandedStageId] = useState(null);

  useEffect(() => {
    setCurrentStages(stages);
  }, [stages]);

  // Calculate overall progress percentage
  const completedCount = currentStages.filter(s => s.status === 'completed').length;
  const hasFailure = currentStages.some(s => s.status === 'failed');
  const progressPercent = currentStages.length > 1 ? (completedCount / (currentStages.length - 1)) * 100 : 0;

  const toggleExpand = (id) => {
    setExpandedStageId(prev => prev === id ? null : id);
  };

  return (
    <div style={{
      maxWidth: '720px',
      margin: '0 auto',
      background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
      borderRadius: '16px',
      padding: '28px 24px',
      boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)',
      border: '1px solid #334155',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#f8fafc'
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #334155',
        paddingBottom: '18px',
        marginBottom: '26px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚡</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
              AP2 / X-402 Execution Tracing
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Real-time pipeline tracking from voice intent to cryptographic settlement
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontWeight: '600',
            background: hasFailure ? 'rgba(239, 68, 68, 0.15)' : completedCount === currentStages.length ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            color: hasFailure ? '#ef4444' : completedCount === currentStages.length ? '#10b981' : '#3b82f6',
            border: `1px solid ${hasFailure ? 'rgba(239, 68, 68, 0.3)' : completedCount === currentStages.length ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
          }}>
            {hasFailure ? '⚠️ Exception Raised' : completedCount === currentStages.length ? '✅ Payment Completed' : `Stage ${completedCount + 1} of 7`}
          </span>
        </div>
      </div>

      {/* Timeline Container */}
      <div style={{ position: 'relative', paddingLeft: '8px' }}>
        {/* Background Vertical Rail */}
        <div style={{
          position: 'absolute',
          top: '20px',
          bottom: '24px',
          left: `${LINE_LEFT}px`,
          width: '3px',
          background: '#334155',
          borderRadius: '2px'
        }} />

        {/* Animated Green Progress Line */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: `${LINE_LEFT}px`,
          width: '3px',
          height: `${Math.min(100, progressPercent)}%`,
          background: hasFailure 
            ? 'linear-gradient(180deg, #10b981 0%, #ef4444 100%)' 
            : 'linear-gradient(180deg, #10b981, #059669)',
          borderRadius: '2px',
          transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
        }} />

        {/* Stages List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {currentStages.map((stage, idx) => {
            const isCompleted = stage.status === 'completed';
            const isCurrent = stage.status === 'current';
            const isFailed = stage.status === 'failed';
            const isUpcoming = stage.status === 'upcoming' || !stage.status;
            const isExpanded = expandedStageId === stage.id;

            return (
              <div 
                key={stage.id} 
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '18px',
                  position: 'relative'
                }}
              >
                {/* Node Icon Circle */}
                <div style={{
                  position: 'relative',
                  width: '40px',
                  height: '40px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2
                }}>
                  {/* Pulsing ring for current active stage */}
                  {isCurrent && (
                    <div style={{
                      position: 'absolute',
                      inset: '-4px',
                      borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.3)',
                      animation: 'tracing-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
                    }} />
                  )}

                  {/* Pulsing red ring for failed stage */}
                  {isFailed && (
                    <div style={{
                      position: 'absolute',
                      inset: '-4px',
                      borderRadius: '50%',
                      background: 'rgba(239, 68, 68, 0.35)',
                      animation: 'tracing-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
                    }} />
                  )}

                  {/* Main Circle Badge */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '13px',
                    transition: 'all 0.3s ease',
                    background: isCompleted 
                      ? '#10b981' 
                      : isFailed 
                        ? '#ef4444' 
                        : isCurrent 
                          ? '#2563eb' 
                          : '#1e293b',
                    border: `2px solid ${
                      isCompleted 
                        ? '#059669' 
                        : isFailed 
                          ? '#dc2626' 
                          : isCurrent 
                            ? '#60a5fa' 
                            : '#475569'
                    }`,
                    color: isUpcoming ? '#94a3b8' : '#ffffff',
                    boxShadow: isCompleted 
                      ? '0 0 12px rgba(16, 185, 129, 0.5)' 
                      : isCurrent 
                        ? '0 0 14px rgba(59, 130, 246, 0.6)' 
                        : isFailed 
                          ? '0 0 14px rgba(239, 68, 68, 0.6)' 
                          : 'none'
                  }}>
                    {isCompleted ? (
                      <span>✓</span>
                    ) : isFailed ? (
                      <span>✕</span>
                    ) : isCurrent ? (
                      <span style={{ animation: 'tracing-spin 2s linear infinite' }}>⚙</span>
                    ) : (
                      <span>{stage.stepNumber}</span>
                    )}
                  </div>
                </div>

                {/* Stage Content Card */}
                <div 
                  onClick={() => toggleExpand(stage.id)}
                  style={{
                    flex: 1,
                    background: isCurrent 
                      ? 'rgba(37, 99, 235, 0.08)' 
                      : isFailed 
                        ? 'rgba(239, 68, 68, 0.08)' 
                        : isCompleted 
                          ? 'rgba(16, 185, 129, 0.04)' 
                          : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${
                      isCurrent 
                        ? 'rgba(59, 130, 246, 0.4)' 
                        : isFailed 
                          ? 'rgba(239, 68, 68, 0.4)' 
                          : isCompleted 
                            ? 'rgba(16, 185, 129, 0.25)' 
                            : '#334155'
                    }`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isCurrent ? '0 4px 14px rgba(37, 99, 235, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: isCompleted ? '#065f46' : isFailed ? '#7f1d1d' : isCurrent ? '#1e3a8a' : '#334155',
                        color: isCompleted ? '#34d399' : isFailed ? '#fca5a5' : isCurrent ? '#93c5fd' : '#94a3b8'
                      }}>
                        Stage {stage.stepNumber}
                      </span>
                      <h3 style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: '600',
                        color: isCompleted || isCurrent ? '#f8fafc' : isFailed ? '#f87171' : '#cbd5e1'
                      }}>
                        {stage.title}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {stage.timestamp && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{stage.timestamp}</span>
                      )}
                      <span style={{ fontSize: '12px', color: '#64748b', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                        ▶
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: isFailed ? '#fca5a5' : '#94a3b8', lineHeight: '1.4' }}>
                    {stage.description}
                  </p>

                  {/* Exception / Failure Alert Box */}
                  {isFailed && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      borderLeft: '3px solid #ef4444',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#fecaca'
                    }}>
                      <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>⚠️ Execution Exception at Stage {stage.stepNumber}:</span>
                      </div>
                      <div style={{ marginTop: '3px', fontFamily: 'monospace', fontSize: '11px' }}>
                        {stage.errorReason || stage.metadata?.error || (stage.decision === 'denied' ? 'User explicitly rejected on Trusted Consent Surface.' : 'Payment authorization failed or rejected.')}
                      </div>
                    </div>
                  )}

                  {/* Expanded Cryptographic & Metadata Inspection Panel */}
                  {isExpanded && stage.metadata && (
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
                        🔍 Stage Metadata & Cryptographic Details:
                      </div>
                      <pre style={{
                        margin: 0,
                        padding: '10px',
                        background: '#090d16',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#38bdf8',
                        overflowX: 'auto',
                        fontFamily: 'monospace'
                      }}>
                        {JSON.stringify(stage.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Inline Keyframes for Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tracing-ping {
          0% { transform: scale(0.95); opacity: 0.8; }
          70%, 100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes tracing-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}

/**
 * Interactive Demo Simulation Helper (Simulates Live Progression & Exceptions)
 */
export function TracingDemoViewer() {
  const [stages, setStages] = useState(DEFAULT_EXECUTION_STAGES);
  const [currentIndex, setCurrentIndex] = useState(0);

  const resetFlow = () => {
    setStages(DEFAULT_EXECUTION_STAGES.map(s => ({ ...s, status: 'upcoming' })));
    setCurrentIndex(0);
  };

  const advanceNextStage = () => {
    if (currentIndex >= stages.length) return;
    
    setStages(prev => prev.map((s, i) => {
      if (i < currentIndex) return { ...s, status: 'completed', timestamp: new Date().toLocaleTimeString() };
      if (i === currentIndex) return { ...s, status: 'completed', timestamp: new Date().toLocaleTimeString() };
      if (i === currentIndex + 1) return { ...s, status: 'current', timestamp: new Date().toLocaleTimeString() };
      return { ...s, status: 'upcoming' };
    }));
    setCurrentIndex(prev => prev + 1);
  };

  const simulateExceptionAt = (stageIndex, errorMsg) => {
    setStages(prev => prev.map((s, i) => {
      if (i < stageIndex) return { ...s, status: 'completed', timestamp: new Date().toLocaleTimeString() };
      if (i === stageIndex) return { 
        ...s, 
        status: 'failed', 
        errorReason: errorMsg,
        timestamp: new Date().toLocaleTimeString() 
      };
      return { ...s, status: 'upcoming' };
    }));
    setCurrentIndex(stageIndex);
  };

  return (
    <div style={{ padding: '20px', background: '#020617', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      {/* Simulation Controls Toolbar */}
      <div style={{
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        background: '#1e293b',
        padding: '12px 18px',
        borderRadius: '12px',
        border: '1px solid #334155'
      }}>
        <button
          onClick={advanceNextStage}
          style={{ padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
        >
          ▶ Advance Next Stage
        </button>
        <button
          onClick={() => simulateExceptionAt(2, "User clicked 'Deny' on Trusted Consent Surface Modal (Stage 3).")}
          style={{ padding: '8px 14px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
        >
          ❌ Simulate Denial at Stage 3
        </button>
        <button
          onClick={() => simulateExceptionAt(5, "Razorpay payment authorization rejected: Card limit exceeded (Stage 6).")}
          style={{ padding: '8px 14px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
        >
          ⚠️ Simulate Razorpay Rejection at Stage 6
        </button>
        <button
          onClick={resetFlow}
          style={{ padding: '8px 14px', background: '#475569', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
        >
          🔄 Reset Flow
        </button>
      </div>

      <TrackingTimeline stages={stages} />
    </div>
  );
}

export default TrackingTimeline;
