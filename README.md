# How I Met Your Tracker v2.0

A hackathon-grade Chrome extension that makes invisible web tracking visible, explainable, and consent-based with **adaptive, context-aware prevention**.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## Core Features

### Adaptive Prevention Engine
- **Risk-Based Scoring**: Dynamic risk calculation (0-100) based on tracker behavior, category, and reputation
- **Context-Aware Enforcement**: Automatically detects checkout/login/payment flows and prevents breaking them
- **4 Enforcement Modes**:
  - **Allow**: No restrictions (green)
  - **Restrict**: Limited fingerprinting, minimized headers (yellow)
  - **Sandbox**: No persistence, isolated execution (orange)
  - **Block**: Completely blocked (red)
- **Deferred Blocking**: High-risk trackers blocked after leaving critical contexts

### Explainable Tracking
- **500+ Known Trackers**: Comprehensive database with owner, category, and purpose
- **Plain English Explanations**: Every tracker explained in human-readable language
- **Risk Transparency**: Shows exactly why each tracker received its risk score
- **Data Collection Details**: Lists what data each tracker collects

### User Control
- **One-Click Overrides**: Allow, restrict, sandbox, or block any tracker manually
- **Tab & Global Scopes**: Override decisions for current tab or all sites
- **Background Mode**: Subtle alerts for high-risk trackers without intrusive UI
- **Privacy Reports**: Export detailed HTML reports with all tracking data

### Privacy-First Design
- **100% Local**: No accounts, no backend, no data sent anywhere
- **No User Tracking**: The extension doesn't track you
- **Transparent Logic**: All decisions based on explainable rules, not "AI black boxes"

##  Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE WORKER (Background)                 │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Network      │→ │ Tracker KB   │→ │ Risk Engine         │  │
│  │ Monitor      │  │ (500+)       │  │ (0-100 scoring)     │  │
│  └──────────────┘  └──────────────┘  └─────────────────────┘  │
│                                                  ↓              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Context      │→ │ Policy       │→ │ Enforcement         │  │
│  │ Detector     │  │ Engine       │  │ (DNR + Deferred)    │  │
│  └──────────────┘  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                 CONTENT SCRIPT (UI + Detection)                 │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ DOM Context  │  │ Glassmorphic │  │ User Override       │  │
│  │ Detection    │  │ UI Overlay   │  │ Management          │  │
│  └──────────────┘  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                        CONFIGURATION                            │
│                                                                 │
│  • policies.json     - Thresholds, patterns, overrides         │
│  • tracker_kb.json   - 500+ tracker database                   │
└─────────────────────────────────────────────────────────────────┘
```


##  Installation & Usage

For detailed system requirements, please see [REQUIREMENTS.md](./REQUIREMENTS.md).
For a step-by-step installation and user guide, please see [USAGE.md](./USAGE.md).

### Quick Start (Load Unpacked)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder

##  Usage Guide

See [USAGE.md](./USAGE.md) for full details on:
- Understanding Risk Scores
- Using the Overlay
- Exporting Reports


##  Configuration

### Adjusting Risk Thresholds

Edit `policies.json`:

```json
{
  "thresholds": {
    "restrict": 30,    // Risk 30+ → Restrict
    "sandbox": 60,     // Risk 60+ → Sandbox  
    "block": 85        // Risk 85+ → Block
  }
}
```

### Adding Custom Trackers

Edit `tracker_kb.json`:

```json
{
  "your-tracker.com": {
    "category": "Analytics",
    "company": "Your Company"
  }
}
```

Category affects base risk:
- **Advertising**: +30 risk
- **Session Recording**: +45 risk
- **Analytics**: +15 risk
- **Payment**: -20 risk (critical)

### Context Detection Patterns

Add URL patterns in `policies.json`:

```json
{
  "contextPatterns": {
    "checkout": ["/checkout", "/cart", "/payment"],
    "login": ["/login", "/signin", "/auth"]
  }
}
```

##  How Risk Scoring Works

Each tracker receives a score (0-100) based on:

### Base Risk (from category)
- Session Recording: 45
- Advertising: 30
- Social: 25
- Analytics: 15
- Payment: 5

### Behavior Signals
- Known high-risk tracker: +35
- Cross-site request: +15
- Excessive frequency (>50 req/5s): +15
- Third-party cookies: +10

### Context Adjustments
- Critical domain (Stripe, PayPal): -30
- Safe domain (CDN): -20
- Active critical context: -10

**Final Score** = Base + Signals + Adjustments (clamped 0-100)

##  File Structure

```
how-i-met-your-tracker-v2/
├── manifest.json                 # Chrome extension manifest (MV3)
├── service_worker.js            # Background processing
├── content_script.js            # UI overlay + DOM detection
├── policies.json                # Configurable thresholds & patterns
├── tracker_kb.json              # 500+ tracker database
├── modules/
│   ├── risk_engine.js          # Risk scoring algorithm
│   ├── policy_engine.js        # Decision logic
│   ├── enforcement.js          # Blocking via DNR
│   ├── context_detector.js     # Critical flow detection
│   └── tracker_knowledge.js    # Knowledge base wrapper
├── ui/
│   └── styles.css              # Glassmorphic UI styles
└── assets/
    ├── icon16.png
    ├── icon48.png
    ├── icon128.png
    └── logo2.png
```

##  Known Limitations (Chrome MV3)

### Technical Constraints
1. **No Dynamic Header Modification**: Can't modify headers on-the-fly (MV3 limitation)
2. **Global Blocking Rules**: DNR rules apply globally, not per-tab
3. **Simulated Sandboxing**: True process isolation not possible in MV3
4. **~5000 Rule Limit**: Chrome limits dynamic blocking rules

### Functional Trade-offs
1. **"Restrict" mode**: Limited effectiveness due to header modification constraints
2. **Frequency limiting**: Can detect but not rate-limit in real-time
3. **Cookie blocking**: Best-effort via response header removal

##  Development

### Running Tests

```bash
# Visit test pages
https://example.com  # Should show Google Analytics
https://news.cnn.com # Should show multiple trackers
```

### Debugging

1. Open Chrome DevTools on any page
2. Check Console for `[HIMT]` prefixed logs
3. Inspect Network tab for blocked requests
4. View `chrome://extensions` for service worker logs

### Testing Critical Contexts

```bash
# Visit these to test context detection:
https://amazon.com/cart
https://stripe.com/checkout
https://github.com/login
```

##  Educational Use

This extension demonstrates:

### Privacy Engineering Concepts
- **Behavioral Analysis**: Risk scoring based on request patterns
- **Context-Aware Systems**: Different rules for different user states
- **Explainable AI**: Transparent decision-making without black boxes

### Chrome Extension Development
- **Manifest V3**: Modern extension architecture
- **Service Workers**: Background processing
- **declarativeNetRequest**: Network blocking API
- **Content Scripts**: Page interaction

### Software Architecture
- **Modular Design**: Separation of concerns
- **Policy-Driven**: Configuration over code
- **Event-Driven**: Reactive programming patterns

##  Hackathon Highlights

### Technical Depth
 Modular architecture with 5+ independent engines  
 Comprehensive risk scoring algorithm  
 Context-aware enforcement with deferred blocking  
 500+ tracker knowledge base integration  
 Glassmorphic UI with smooth animations  

### Product Clarity
 Clear value proposition: "See what tracks you, control it"  
 Plain English explanations for every decision  
 Non-intrusive background mode  
 One-click overrides for user control  
 Privacy-first design (no data collection)  

### Innovation
 First extension to combine adaptive risk scoring + context awareness  
 Novel "deferred blocking" for critical flows  
 Explainable tracking (not just blocking)  
 Policy-driven approach (ML-ready architecture)  

##  Future Enhancements

### Post-Hackathon Ideas
- [ ] **ML Risk Prediction**: Train on user feedback to improve scoring
- [ ] **Threat Intelligence**: Real-time updates from privacy community
- [ ] **Visual Network Graph**: See tracker relationships
- [ ] **Site Profiles**: Per-site privacy preferences
- [ ] **Encrypted Sync**: Cross-device settings (no account needed)
- [ ] **TCF Integration**: Support for IAB Transparency & Consent Framework
- [ ] **Privacy Badger Heuristics**: Learn tracking behavior over time

##  License

MIT License - feel free to use, modify, and build upon this project!

##  Contributing

This is a hackathon project, but contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

##  Disclaimer

This extension is for **educational and demonstration purposes**. It uses Chrome's declarativeNetRequest API which has limitations. For production use, additional testing, security auditing, and compliance review would be required.

##  Support

For questions, issues, or feedback:
- Open an issue on GitHub
- Check the [Architecture Documentation](ARCHITECTURE.md)
- Review the inline code comments

---

**Built with for privacy conscious users**

*Making invisible tracking visible, one tracker at a time.*
