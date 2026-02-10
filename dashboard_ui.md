# How I Met Your Tracker – Analytics Dashboard Specification

This document outlines the complete set of analytics, visualizations, and insights to be included in the dashboard for **How I Met Your Tracker**.  
It is intended for **UI/UX designers** and **frontend/backend developers** to align on scope, structure, and intent.

---

## 1. Dashboard Goals

The dashboard should:
- Give users a **clear, human-readable understanding** of how they are being tracked
- Visualize **historical tracking behavior**, not just per-page activity
- Highlight **companies, categories, and risks**
- Enable **research-grade insights** while remaining accessible to non-technical users

---

## 2. Dashboard Structure (High-Level)

Recommended main sections:
1. Privacy Snapshot (Overview)
2. Company-Level Tracking
3. Category Distribution
4. Website-Level Analysis
5. Timeline & Behavioral Patterns
6. Consent & Context Awareness
7. Unknown / Suspicious Trackers
8. User Control & Impact
9. Research & Export View (Optional)

---

## 3. Privacy Snapshot (Landing View)

### Purpose
Instantly answer: *“How much am I being tracked?”*

### Metrics
- Total number of network requests
- Total number of third-party tracking requests
- Number of unique trackers (domains)
- Number of unique companies involved
- Percentage of requests that are trackers
- Overall **Privacy Exposure Score** (single number or grade)

### UI Notes
- Use cards or tiles
- Keep explanations short and tooltippable
- This should be the default landing view

---

## 4. Company-Level Tracking Analytics

### Purpose
Show **who** is tracking the user the most.

### Visualizations
- Top 10 companies by number of tracking requests
- Bar or pie chart showing share of total tracking per company
- Company request count over time (trend view)

### Additional Insights
- Number of unique websites each company appears on
- “High reach, low visibility” companies (appear on many sites but make few requests per site)

---

## 5. Category Distribution

### Purpose
Explain **what kind of tracking** is happening.

### Categories (based on tracker KB)
- Analytics
- Advertising
- Fingerprinting (General / Invasive)
- Email & Engagement
- Social
- Content / CDN
- Unknown

### Visualizations
- Category-wise request count
- Category-wise percentage distribution
- Category trends over time

### Optional
- Category breakdown per website
- Category dominance comparison between sites

---

## 6. Website-Level Privacy Analysis

### Purpose
Let users understand which sites are more privacy-invasive.

### Per-Site Metrics
- Total requests
- Number of trackers
- Tracker density (trackers per page load)
- Dominant tracking category
- Dominant company

### Derived Scores
- Website Privacy Rating (e.g. A–F or 1–5)
- Short explanation text:
  > “This site relies heavily on advertising and fingerprinting services.”

### UI Notes
- Sortable table
- Click-through to site-specific detail view

---

## 7. Timeline & Behavioral Patterns

### Purpose
Reveal *when* tracking intensifies.

### Visualizations
- Requests per hour/day
- Tracker spikes during:
  - Login
  - Checkout
  - Payment
  - Form submission

### Insights
- Compare passive browsing vs high-intent actions
- Highlight unusual spikes or anomalies

---

## 8. Consent & Context Awareness

### Purpose
Demonstrate whether tracking respects user intent.

### Analytics
- Trackers firing before user interaction
- Trackers firing after explicit actions
- Trackers active during critical contexts (login, checkout)
- Trackers that persist after cookie rejection (if detectable)

### Research Value
This section strongly supports ethical and compliance discussions.

---

## 9. Unknown & Suspicious Trackers

### Purpose
Expose uncertainty and opacity in the tracking ecosystem.

### Metrics
- Percentage of requests to unknown companies
- Top unknown domains by frequency
- Categories where unknown trackers dominate

### UI Notes
- Clearly label as “Unknown / Unverified”
- Provide educational context, not alarmism

---

## 10. User Control & Impact

### Purpose
Show users the **effect of their decisions**.

### Analytics
- Trackers allowed vs restricted vs blocked
- Reduction in tracking over time
- Before/after comparisons when rules change
- Weekly or monthly privacy improvement summary

### Example Insight
> “You reduced fingerprinting-related requests by 42% this week.”

---

## 11. Research & Advanced View (Optional)

### Intended Audience
Researchers, auditors, committee reviewers

### Features
- Raw numerical summaries
- Definitions of categories and metrics
- Assumptions and known limitations
- Export options (CSV / JSON)

---

## 12. Design Principles

- Default to **clarity over density**
- Every chart should answer one clear question
- Always provide a short textual explanation
- Avoid fear-based language; focus on transparency
- Progressive disclosure: simple → advanced

---

## 13. Key Takeaway

This dashboard is not just analytics.

It is a **personal data exhaust report**, designed to:
- Make invisible tracking visible
- Attribute responsibility to real companies
- Empower users through understanding

