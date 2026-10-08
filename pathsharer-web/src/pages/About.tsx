import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AirportReminderOverlay from '../components/AirportReminderOverlay';

export default function About() {
    const navigate = useNavigate();
    const [showReminderPrompt, setShowReminderPrompt] = useState(false);
    const [installPrompt, setInstallPrompt] = useState<any>(null);

    useEffect(() => {
        const handleInstallPrompt = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event);
        };
        window.addEventListener('beforeinstallprompt', handleInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    }, []);

    async function installPathsharer() {
        if (!installPrompt) return;
        await installPrompt.prompt();
        setInstallPrompt(null);
    }

    function wipeLocalData() {
        localStorage.clear();
        alert("Local data cleared");
    }
    return (
        <div className="about-page">
            <div className="about-card">
                <small style={{ color: "black" }}>About</small><h1 style={{ marginBottom: 0 }}>Pathsharer</h1>
                <small style={{ color: "black" }}>
                    find copassengers at Airports ✈️<br />and save big</small>
                <br /><br />

                <small style={{ color: "black" }} >
                    Find co-passengers to share commute and split costs to save big.<br />
                    No user data is saved, so practice caution when meeting strangers.<br /><br />
                    Kindly write to me for feedback or suggestions
                </small>
                <br />
                <br />

                <div className="about-section">
                    <span className="label">Contact</span>
                    <a href="mailto:heypratik.js@gmail.com">
                        heypratik.js@gmail.com
                    </a>
                </div>

                <section className="about-feature-section">
                    <h2>Airport reminders</h2>
                    <p>Get a reminder when your location is near an airport. Notifications and location access are optional.</p>
                    <button className="find-btn find-btn--active" onClick={() => setShowReminderPrompt(true)}>
                        Enable airport reminders
                    </button>
                </section>

                <section className="about-feature-section">
                    <h2>Install Pathsharer</h2>
                    {installPrompt && (
                        <button className="find-btn find-btn--active" onClick={installPathsharer}>
                            Install Pathsharer
                        </button>
                    )}
                    <div className="install-instructions">
                        <p><strong>Android:</strong> Open this page in Chrome, tap the menu, then choose <em>Install app</em> or <em>Add to Home screen</em>.</p>
                        <p><strong>iPhone/iPad:</strong> On iOS 16.4 or later, open in Safari, tap Share, then choose <em>Add to Home Screen</em>.</p>
                        <p><strong>Desktop:</strong> In Chrome or Edge, use the install icon in the address bar or choose <em>Install Pathsharer</em> from the browser menu.</p>
                    </div>
                    <p className="about-location-note">Location checks run while Pathsharer is open. Browsers may suspend location access after the app is closed; installing the PWA does not enable background GPS.</p>
                </section>

                <div className="about-section">
                    <span className="label">Version</span>
                    <span>v1.0.0 (alpha)</span>
                </div>

                <div className="about-section">
                    <span className="label">Released</span>
                    <span>12 July 2026</span>
                </div>

                <button className="find-btn" style={{ border: "solid 1px black", backgroundColor: "red", color: "white" }} onClick={wipeLocalData}>Clear Local Data</button>
                <br />
                <button className="find-btn" style={{ border: "solid 1px black" }} onClick={() => navigate(-1)}>OK</button>
            </div>
            <AirportReminderOverlay open={showReminderPrompt} onClose={() => setShowReminderPrompt(false)} />
        </div>
    );
}