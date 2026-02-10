# Usage Guide

## 📦 Installation

Since this is a developer preview/hackathon project, you will need to load it as an "Unpacked Extension" in Chrome.

1.  **Download/Clone** this repository to your local machine.
2.  Open **Google Chrome**.
3.  Navigate to `chrome://extensions/` in the address bar.
4.  Toggle **Developer mode** on in the top-right corner.
5.  Click the **Load unpacked** button (top-left).
6.  Select the **root folder** of this project (`DevSocfinal/DevSoc`).

The extension icon should now appear in your browser toolbar.

## 🚀 Features & How to Use

### 1. Real-time Tracker Detection
- Navigate to any website (e.g., `cnn.com`, `reddit.com`).
- The extension icon will display a badge count of detected trackers.
- Click the icon to open the **Glassmorphic Overlay**.

### 2. Risk Assessment
- Each tracker is assigned a **Risk Score** (0-100).
- **Color Coding**:
    - 🟢 **Green (Safe)**: Low risk (<30).
    - 🟡 **Yellow (Caution)**: Medium risk (30-59).
    - 🟠 **Orange (High Risk)**: High risk (60-84), sandboxed.
    - 🔴 **Red (Blocked)**: Critical risk (85+), blocked.

### 3. User Controls
- **Global Toggle**: Turn the entire extension on/off from the dashboard.
- **Per-Tracker Override**:
    - Click any tracker in the list to see details.
    - Use the buttons to manually **Allow**, **Sandbox**, or **Block** that specific tracker.

### 4. Context Awareness
- The extension automatically detects sensitive contexts like **Payment Pages** or **Login Screens**.
- In these contexts, strict blocking is temporarily relaxed to **Sandbox** mode to prevent breaking critical checkout flows.

## 🛠️ Troubleshooting

**Extension icon is grayed out?**
- Refresh the page. Content scripts sometimes don't load on pages that were already open before installation.

**Site functionality broken?**
- Open the extension overlay.
- Look for "Blocked" trackers.
- Try setting them to "Sandbox" or "Allow" to see if proper functionality is restored.

**How to uninstall?**
- Go to `chrome://extensions/`.
- Find "How I Met Your Tracker".
- Click **Remove**.
