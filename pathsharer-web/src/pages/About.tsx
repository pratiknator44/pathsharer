import { useNavigate } from 'react-router-dom';

export default function About() {
    const navigate = useNavigate();

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
        </div>
    );
}