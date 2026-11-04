'use client';

import React from 'react';

/** Cadangan terakhir bila layout utama sendiri yang error (menggantikan seluruh halaman, jadi harus membawa <html> sendiri). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: 'Arial, sans-serif', background: '#f1f5f9', color: '#1e293b', margin: 0, padding: 24 }}>
        <div style={{ maxWidth: 420, margin: '40px auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px' }}>Aplikasi mengalami kesalahan</h2>
          <p style={{ fontSize: 14, color: '#475569' }}>Data di server tidak berubah. Coba muat ulang; bila terulang, keluar lalu masuk kembali.</p>
          <button onClick={() => reset()} style={{ marginTop: 12, background: '#0d9488', color: '#fff', border: 0, borderRadius: 8, padding: '8px 18px', fontWeight: 600 }}>
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
