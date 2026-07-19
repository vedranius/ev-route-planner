import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { userData, updateUserData, sendVerification, currentUser } = useAuth();
  const [displayName, setDisplayName] = useState(userData?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    await updateUserData({ displayName });
    setMessage('Profile updated!');
    setTimeout(() => setMessage(''), 3000);
    setSaving(false);
  };

  const handleVerifyEmail = async () => {
    await sendVerification();
    setMessage('Verification email sent!');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Profile</h2>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] text-sm fade-in">
          {message}
        </div>
      )}

      <div className="card mb-4">
        <h3 className="font-semibold mb-3">Account Info</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="" className="w-14 h-14 rounded-full" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#334155] flex items-center justify-center text-xl font-bold">
                {(userData?.displayName || 'U')[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm text-[#94a3b8]">Email</p>
              <p className="font-medium">{currentUser?.email}</p>
              {currentUser?.emailVerified ? (
                <span className="badge badge-green text-xs">Verified</span>
              ) : (
                <button onClick={handleVerifyEmail} className="text-xs text-[#f59e0b] hover:underline">
                  Verify email
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#94a3b8] mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field"
            />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="font-semibold mb-3">Two-Factor Authentication</h3>
        {userData?.twoFactorEnabled ? (
          <div className="flex items-center gap-2">
            <span className="badge badge-green">2FA Enabled</span>
            <p className="text-sm text-[#94a3b8]">Your account is secured with 2FA</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-[#94a3b8] mb-3">
              Add an extra layer of security to your account using an authenticator app.
            </p>
            <p className="text-xs text-[#64748b]">
              2FA setup requires a backend server. This feature is available when using the mobile app version.
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2">About</h3>
        <p className="text-sm text-[#94a3b8]">EV Route Planner v1.0</p>
        <p className="text-xs text-[#64748b] mt-1">
          Smart route planning for electric vehicles with real-time charger data.
          Built with OpenStreetMap, OpenChargeMap, and Firebase.
        </p>
      </div>
    </div>
  );
}
