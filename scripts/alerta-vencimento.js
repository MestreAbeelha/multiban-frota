
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// ── Firebase config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBllIpgVEDQeSYMQuitkXSW6coeRP6MmU4",
  authDomain: "frota-multiban.firebaseapp.com",
  projectId: "frota-multiban",
  storageBucket: "frota-multiban.firebasestorage.app",
  messagingSenderId: "128926731096",
  appId: "1:128926731096:web:98343ea1a3d7fb4c7a332d"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Helpers ──────────────────────────────────────────────────────
function diasParaVencer(dataISO) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const alvo = new Date(dataISO + "T00:00:00");
  return Math.round((alvo - hoje) / 86400000);
}

function fmtDate(iso) {
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Enviar email via Resend ───────────────────────────────────────
async function enviarEmail(destinatario, assunto, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Frota Multiban <onboarding@resend.dev>",
      to: [destinatario],
      subject: assunto,
      html
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

function gerarHtml(titulo, veiculos, cor, mensagem) {
  const linhas = veiculos.map(v => `
    <tr>
      <td style="padding:10px 14px;font-weight:700;font-size:1rem;letter-spacing:1px;">${v.placa}</td>
      <td style="padding:10px 14px;">${v.modelo || "—"}</td>
      <td style="padding:10px 14px;">${fmtDate(v.vencimento)}</td>
      <td style="padding:10px 14px;">${v.obs || "—"}</td>
    </tr>
  `).join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0F3D72;padding:24px 32px;border-radius:10px 10px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:1.4rem;letter-spacing:.5px;">🚛 Frota Multiban</h1>
        <p style="color:#A8BEDB;margin:4px 0 0;font-size:.85rem;">Alerta de Vencimento CRLV</p>
      </div>
      <div style="background:#fff;padding:28px 32px;border:1px solid #E2EAF4;border-top:none;">
        <div style="background:${cor.bg};border-left:4px solid ${cor.borda};padding:14px 18px;border-radius:6px;margin-bottom:24px;">
          <strong style="color:${cor.texto};font-size:1rem;">${titulo}</strong>
          <p style="color:${cor.texto};margin:6px 0 0;font-size:.9rem;">${mensagem}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:.88rem;">
          <thead>
            <tr style="background:#1B5EAB;color:#fff;">
              <th style="padding:10px 14px;text-align:left;">Placa</th>
              <th style="padding:10px 14px;text-align:left;">Modelo</th>
              <th style="padding:10px 14px;text-align:left;">Vencimento</th>
              <th style="padding:10px 14px;text-align:left;">Observações</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
      <div style="background:#F4F7FB;padding:14px 32px;border-radius:0 0 10px 10px;text-align:center;">
        <p style="color:#4A6285;font-size:.78rem;margin:0;">Mensagem automática — Gestão de Frota Multiban</p>
      </div>
    </div>
  `;
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const destinatario = process.env.EMAIL_DESTINO;
  const snap = await getDocs(collection(db, "veiculos"));
  const veiculos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const vencidos = veiculos.filter(v => diasParaVencer(v.vencimento) <= 0);

  if (vencidos.length > 0) {
    await enviarEmail(
      destinatario,
      `🚨 CRLV Vencido — ${vencidos.length} veículo(s)`,
      gerarHtml(
        "⚠️ CRLV Vencido",
        vencidos,
        { bg: "#FDECEA", borda: "#C0392B", texto: "#C0392B" },
        `${vencidos.length} veículo(s) com CRLV vencido. Regularize o quanto antes.`
      )
    );
    console.log(`✅ Email de vencidos enviado para ${destinatario}`);
  } else {
    console.log("✅ Nenhuma placa vencida hoje.");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
