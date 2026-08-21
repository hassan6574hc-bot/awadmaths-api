const RESEND_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL   = 'awadmaths@outlook.com';
const FROM_EMAIL = 'onboarding@resend.dev';

function generateNarrative(studentName, yearGroup, testResults, totalCorrect, totalPossible, overallPct) {
  const sorted = [...testResults].map(tr => {
    const correct = tr.answers.filter(a => a.correct).length;
    const pct = Math.round((correct / tr.answers.length) * 100);
    return { label: tr.label, correct, total: tr.answers.length, pct };
  }).sort((a, b) => a.pct - b.pct);

  const weakest = sorted[0];
  const secondWeakest = sorted[1];
  const strongest = sorted[sorted.length - 1];

  const level =
    overallPct >= 80 ? 'working at a strong Grade 6-7 level' :
    overallPct >= 65 ? 'working at a solid Grade 5-6 level' :
    overallPct >= 50 ? 'working at a Grade 4-5 level with clear gaps to close' :
    overallPct >= 35 ? 'working at a Grade 3-4 level - foundations need reinforcing' :
    'working below Grade 3 - foundational gaps are significant';

  const urgency =
    weakest.pct < 30 ? 'a critical gap that will block progress across multiple topics' :
    weakest.pct < 50 ? 'a significant gap that needs direct attention' :
    'an area with room for improvement';

  const p1 = studentName + ' (' + (yearGroup || 'year group TBC') + ') scored ' + totalCorrect + '/' + totalPossible + ' overall (' + overallPct + '%), ' + level + '. The results give a clear picture of where the foundation is solid and where the cracks are - use this to steer the call.';
  const p2 = 'The two weakest areas are ' + weakest.label + ' (' + weakest.pct + '%) and ' + secondWeakest.label + ' (' + secondWeakest.pct + '%). ' + weakest.label + ' is ' + urgency + (weakest.pct < 40 ? ' - this is where to start, not the hardest topics' : '') + '. ' + secondWeakest.label + ' at ' + secondWeakest.pct + '% suggests gaps that will compound over time if left.';
  const p3 = 'The single most important starting point is ' + weakest.label + '. Until that is stable, progress in other areas will be slower than it should be. On the call, probe: what does ' + studentName + ' think their weakest area is? How are they currently studying? And what is the parent main concern - grade target, confidence, or exam preparation?';
  const p4 = strongest.pct >= 70
    ? 'On a positive note, ' + strongest.label + ' at ' + strongest.pct + '% shows there is a base to build from. With consistent, structured work targeting the foundations first, meaningful improvement is realistic within 2-3 months.'
    : 'There is work to do across the board, but nothing here is unfixable. With the right method and consistent effort, meaningful progress is achievable - be honest with the parent about the timeline and what it requires from the student.';

  return p1 + '\n\n' + p2 + '\n\n' + p3 + '\n\n' + p4;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { studentName, yearGroup, testResults } = req.body || {};
  if (!studentName || !testResults) {
    return res.status(400).json({ error: 'Missing data' });
  }

  const totalCorrect = testResults.reduce((s, tr) => s + tr.answers.filter(a => a.correct).length, 0);
  const totalPossible = testResults.reduce((s, tr) => s + tr.answers.length, 0);
  const overallPct = Math.round((totalCorrect / totalPossible) * 100);
  const narrative = generateNarrative(studentName, yearGroup, testResults, totalCorrect, totalPossible, overallPct);

  const topicRows = testResults.map(tr => {
    const correct = tr.answers.filter(a => a.correct).length;
    const pct = Math.round((correct / tr.answers.length) * 100);
    const color = pct >= 70 ? '#1C7A47' : pct >= 45 ? '#C9922A' : '#B83232';
    return '<tr><td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #f0f0f0;">' + tr.label + '</td><td style="padding:8px 12px;font-size:14px;font-weight:700;color:' + color + ';border-bottom:1px solid #f0f0f0;">' + correct + '/' + tr.answers.length + '</td><td style="padding:8px 12px;font-size:14px;color:' + color + ';border-bottom:1px solid #f0f0f0;">' + pct + '%</td></tr>';
  }).join('');

  const breakdownHtml = testResults.map(tr => {
    const correct = tr.answers.filter(a => a.correct).length;
    const rows = tr.answers.map((a, i) => {
      const res2 = a.correct ? '<span style="color:#1C7A47;font-weight:700;">PASS</span>' : '<span style="color:#B83232;font-weight:700;">FAIL</span>';
      return '<tr style="border-bottom:1px solid #f5f5f5;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;white-space:nowrap;">Q' + (i+1) + ' Gr' + a.grade + '</td><td style="padding:8px 12px;font-size:13px;">' + a.text + '</td><td style="padding:8px 12px;font-size:13px;text-align:center;">' + res2 + '</td><td style="padding:8px 12px;font-size:12px;color:#6b7280;">' + (!a.correct ? (a.explanation || '') : '') + '</td></tr>';
    }).join('');
    return '<h3 style="font-size:14px;font-weight:700;color:#0D1B2A;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #C9922A;">' + tr.label + ' - ' + correct + '/' + tr.answers.length + '</h3><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f9fafb;"><th style="padding:8px 12px;font-size:11px;text-align:left;color:#6b7280;">Q</th><th style="padding:8px 12px;font-size:11px;text-align:left;color:#6b7280;">Question</th><th style="padding:8px 12px;font-size:11px;text-align:center;color:#6b7280;">Result</th><th style="padding:8px 12px;font-size:11px;text-align:left;color:#6b7280;">Explanation</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }).join('');

  const dateStr = new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'});
  const emailHtml = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;"><div style="max-width:720px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;"><div style="background:#0D1B2A;padding:28px 40px;"><div style="font-size:24px;font-weight:900;color:#fff;">Awad<span style="color:#C9922A;">Maths</span></div><div style="font-size:12px;color:#8A9EAF;margin-top:4px;letter-spacing:.08em;text-transform:uppercase;">Diagnostic Report - For Hassan Only</div></div><div style="padding:28px 40px;border-bottom:1px solid #e5e7eb;"><div style="font-size:22px;font-weight:700;color:#0D1B2A;">' + studentName + '</div><div style="font-size:14px;color:#6b7280;margin-top:4px;">' + (yearGroup||'Year group not provided') + ' - ' + dateStr + '</div><div style="margin-top:20px;"><span style="background:#0D1B2A;color:#C9922A;font-size:32px;font-weight:900;padding:12px 28px;border-radius:8px;display:inline-block;">' + totalCorrect + '/' + totalPossible + '</span><span style="margin-left:12px;font-size:18px;color:#6b7280;">' + overallPct + '% overall</span></div></div><div style="padding:28px 40px;border-bottom:1px solid #e5e7eb;"><div style="font-size:12px;font-weight:700;color:#0D1B2A;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">Topic Breakdown</div><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f9fafb;"><th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;">Topic</th><th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;">Score</th><th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;">%</th></tr></thead><tbody>' + topicRows + '</tbody></table></div><div style="padding:28px 40px;border-bottom:1px solid #e5e7eb;background:#fafafa;"><div style="font-size:12px;font-weight:700;color:#0D1B2A;text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px;">Pre-Call Assessment</div><div style="border-left:4px solid #C9922A;padding-left:20px;">' + narrative.split('\n\n').map(p => '<p style="font-size:15px;color:#1f2937;line-height:1.85;margin:0 0 16px;">' + p + '</p>').join('') + '</div></div><div style="padding:28px 40px;"><div style="font-size:12px;font-weight:700;color:#0D1B2A;text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px;">Full Question Breakdown</div>' + breakdownHtml + '</div><div style="padding:20px 40px;background:#0D1B2A;text-align:center;"><div style="font-size:12px;color:#5F7285;">Awad Maths - Hassan Awad - Madinah</div></div></div></body></html>';

  try {
    // native fetch available in Node 18+
    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + RESEND_KEY },
      body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAIL, subject: 'Awad Maths Diagnostic - ' + studentName + ' (' + (yearGroup||'Year TBC') + ') - ' + totalCorrect + '/' + totalPossible + ' (' + overallPct + '%)', html: emailHtml })
    });
    if (!emailResp.ok) {
      const err = await emailResp.text();
      return res.status(500).json({ success: false, error: err });
    }
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }

  return res.status(200).json({ success: true });
};
