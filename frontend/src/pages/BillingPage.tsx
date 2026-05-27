import React, { useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../auth/AuthContext';
import '../styles/onboarding.css';

const annualPrices = [
  { max: 2, unitPrice: 0, packagePrice: 97 },
  { max: 30, unitPrice: 10 },
  { max: 60, unitPrice: 9 },
  { max: 100, unitPrice: 8 },
  { max: 200, unitPrice: 7 },
];

const monthlyPrices = [
  { max: 2, unitPrice: 0, packagePrice: 123.75 },
  { max: 30, unitPrice: 13.75 },
  { max: 60, unitPrice: 12.5 },
  { max: 100, unitPrice: 11.25 },
  { max: 200, unitPrice: 10 },
];

const calculatePrice = (units: number, pricing: typeof annualPrices) => {
  if (units <= 2) {
    return pricing[0].packagePrice ?? 0;
  }

  let total = pricing[0].packagePrice ?? 0;
  let remaining = units - 2;
  let start = 3;

  for (let i = 1; i < pricing.length && remaining > 0; i += 1) {
    const tier = pricing[i];
    const prevMax = pricing[i - 1].max;
    const tierUnits = Math.min(remaining, tier.max - prevMax);
    total += tierUnits * (tier.unitPrice ?? 0);
    remaining -= tierUnits;
    start = tier.max + 1;
  }

  return total;
};

const getCurrentTierLabel = (units: number, pricing: typeof annualPrices) => {
  for (const tier of pricing) {
    if (units <= tier.max) {
      if (tier.max === 2) {
        return `Package rate: $${tier.packagePrice?.toFixed(2)} per month`;
      }
      return `${tier.unitPrice}/unit for units ${tier.max === 30 ? '3-30' : tier.max === 60 ? '31-60' : tier.max === 100 ? '61-100' : '101-200'}`;
    }
  }
  return 'Contact sales for custom pricing';
};

const getPricingDetails = (units: number, pricing: typeof annualPrices) => {
  const details = [{ label: 'Platform Base Includes first 2 units', value: pricing[0].packagePrice ?? 0 }];
  let remaining = Math.max(0, units - 2);
  let prevMax = 2;

  for (let i = 1; i < pricing.length && remaining > 0; i += 1) {
    const tier = pricing[i];
    const tierUnits = Math.min(remaining, tier.max - prevMax);
    if (tierUnits > 0) {
      details.push({
        label: `Next ${tierUnits} unit${tierUnits === 1 ? '' : 's'} x $${tier.unitPrice}/unit`,
        value: tierUnits * (tier.unitPrice ?? 0),
      });
      remaining -= tierUnits;
      prevMax = tier.max;
    }
  }

  return details;
};

const BillingPage: React.FC = () => {
  const { tenant } = useAuth();
  const [billingMode, setBillingMode] = useState<'monthly' | 'annual'>('monthly');
  const [selectedUnits, setSelectedUnits] = useState(3);

  const pricingData = billingMode === 'annual' ? annualPrices : monthlyPrices;
  const price = useMemo(() => calculatePrice(selectedUnits, pricingData), [selectedUnits, pricingData]);
  const tierLabel = useMemo(() => getCurrentTierLabel(selectedUnits, pricingData), [selectedUnits, pricingData]);
  const pricingDetails = useMemo(() => getPricingDetails(selectedUnits, pricingData), [selectedUnits, pricingData]);
  const billingCaption = billingMode === 'annual' ? 'Billed annually in advance' : 'Billed monthly';
  const sliderPercent = useMemo(() => {
    const min = 1;
    const max = 200;
    const baseRatio = (selectedUnits - min) / (max - min);
    return Math.max(0, Math.min(100, baseRatio * 100));
  }, [selectedUnits]);

  return (
    <div className="page-shell page-shell--dashboard">
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main settings-main">
          <section className="settings-container billing-page-container">
            <div className="pricing-card pricing-card--centered">
              <div className="pricing-card-header">
                <span className="eyebrow">Flexible billing</span>
                <div className="billing-toggle-group">
                  <button
                    type="button"
                    className={`pricing-toggle-btn ${billingMode === 'monthly' ? 'active' : ''}`}
                    onClick={() => setBillingMode('monthly')}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    className={`pricing-toggle-btn ${billingMode === 'annual' ? 'active' : ''}`}
                    onClick={() => setBillingMode('annual')}
                  >
                    Annual
                  </button>
                </div>
              </div>

              <div className="pricing-summary">
                <div className="pricing-summary-left">
                  <p className="muted">Connected Units (Projects or Repositories)</p>
                  <h2>{selectedUnits}</h2>
                </div>
                <div className="pricing-summary-right">
                  <p className="muted">{billingCaption}</p>
                  <h1>${price.toFixed(2)}<span className="per">/mo</span></h1>
                </div>
              </div>

              <div className="billing-slider-card">
                <div className="billing-slider-wrapper">
                  <input
                    className="billing-slider-input"
                    type="range"
                    min={1}
                    max={200}
                    value={selectedUnits}
                    aria-valuemin={1}
                    aria-valuemax={200}
                    aria-valuenow={selectedUnits}
                    onChange={(event) => setSelectedUnits(Number(event.target.value))}
                  />
                  <div className="billing-slider-track">
                    <div className="billing-slider-fill" style={{ width: `${sliderPercent}%` }} />
                    <div className="billing-slider-thumb" style={{ left: `${sliderPercent}%` }} />
                  </div>
                </div>
                <div className="slider-labels">
                  <span>1</span>
                  <span>50</span>
                  <span>100</span>
                  <span>150</span>
                  <span>200+</span>
                </div>
              </div>

              <div className="pricing-detail-box">
                <div className="pricing-detail-title">Pricing Detail</div>
                <div className="pricing-detail-items">
                  {pricingDetails.map((detail) => (
                    <div key={detail.label} className="pricing-detail-row">
                      <span>{detail.label}</span>
                      <strong>${detail.value.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
                <div className="pricing-detail-row pricing-detail-total">
                  <span>Monthly total</span>
                  <strong>${price.toFixed(2)}</strong>
                </div>
              </div>

              <div className="pricing-actions">
                <button type="button" className="button button-primary">Start 14-day Free Trial</button>
                <p className="pricing-footnote">No credit card required.</p>
              </div>

              <p className="contact-link">Need more than 200 units? <a href="/billing">Contact us for volume pricing.</a></p>
            </div>

            <section className="support-section">
              <h2>Choose Your Support Level</h2>
              <p className="subtext">Need help setting up specific KPIs? We've got you covered.</p>
              <div className="support-grid">
                <div className="support-card support-card--highlighted">
                  <h3>Standard Support</h3>
                  <p className="support-price">Included - Free Forever</p>
                  <ul>
                    <li>Account Administration</li>
                    <li>Subscription Management</li>
                    <li>Users Management</li>
                    <li>Technical Troubleshooting</li>
                    <li>Contact via Generic Email</li>
                    <li>Contact via In-Platform Chat</li>
                  </ul>
                </div>
                <div className="support-card support-card--premium">
                  <div className="support-pill">For faster setup</div>
                  <h3>Product Expert Support</h3>
                  <p className="support-price">$499 + $1/unit per month (First 3 months)</p>
                  <p className="support-price support-price-secondary">$999 + $1/unit per month thereafter</p>
                  <ul>
                    <li>All Standard Support features</li>
                    <li>Priority Support Queue</li>
                    <li>Dedicated Account Expert</li>
                    <li>Dedicated Contact Email</li>
                    <li>Custom Insights & Dashboards Creation (5 hrs per month)</li>
                  </ul>
                  <p className="support-note">Activation in platform. Cancel anytime.</p>
                </div>
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  );
};

export default BillingPage;
