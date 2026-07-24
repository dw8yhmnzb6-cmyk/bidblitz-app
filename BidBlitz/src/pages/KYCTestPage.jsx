import { useState } from "react";
import KYCVerificationModal from "../components/KYCVerificationModal";
import BottomNav from "../components/BottomNav";

const KYCTestPage = () => {
  const [showKYC, setShowKYC] = useState(true);

  return (
    <div className="min-h-screen bg-[#040610] p-4">
      <div className="max-w-md mx-auto pt-20">
        <h1 className="text-2xl font-bold text-white mb-4">KYC Modal Test</h1>
        <p className="text-white/60 mb-6">
          Teste das KYC-Modal auf Mobile. Das Modal sollte nicht die Bottom-Navigation überdecken.
        </p>
        
        <button
          onClick={() => setShowKYC(true)}
          className="px-6 py-3 bg-[#00C2FF] text-black font-bold rounded-xl">
          KYC Modal öffnen
        </button>

        <div className="mt-8 p-4 bg-white/5 rounded-xl">
          <h2 className="text-white font-bold mb-2">Test-Schritte:</h2>
          <ol className="text-white/60 text-sm space-y-2">
            <li>1. Öffne auf Mobile (375px breit)</li>
            <li>2. Klicke "KYC Modal öffnen"</li>
            <li>3. Scrolle nach unten</li>
            <li>4. Bottom-Nav sollte IMMER sichtbar sein</li>
            <li>5. Modal sollte 80px Abstand zur Bottom-Nav haben</li>
          </ol>
        </div>
      </div>

      {/* KYC Modal */}
      <KYCVerificationModal
        open={showKYC}
        onClose={() => setShowKYC(false)}
        onComplete={() => {
          setShowKYC(false);
          alert("KYC abgeschlossen!");
        }}
      />

      {/* Bottom Nav - immer sichtbar */}
      <BottomNav
        currentPath="/test"
        onNavigate={(path) => console.log("Navigate to:", path)}
        onShowBarcode={() => console.log("Show barcode")}
      />
    </div>
  );
};

export default KYCTestPage;
