export const config = { runtime: 'edge' };

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_KEY    = process.env.RESEND_API_KEY;
const TO_EMAIL      = 'Hassan6574hc@gmail.com';
const FROM_EMAIL    = 'onboarding@resend.dev';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { studentName, yearGroup, testResults } = body;
  if (!studentName || !testResults) {
    return new Response('Missing data', { status: 400 });
  }

  const scoreSummary = testResults.map(tr => {
    const correct = tr.answers.filter(a => a.correct).length;
    const total = tr.answers.length;
    const pct = Math.round((correct / total) * 100);
    const weak = tr.answers.filter(a => !a.correct).map(a => `Grade ${a.grade} - ${a.text.slice(0, 70)}`).join('; ');
    return `${tr.label}: ${correct}/${total} (${pct}%)${weak ? '. Missed: ' + weak : ''}`;
  }).join('\n');

  const totalCorrect = testResults.reduce((s, tr) => s + tr.answers.filter(a => a.correct).length, 0);
  const totalPossible = testResults.reduce((s, tr) => s + tr.answers.length, 0);
  const overallPct = Math.round((totalCorrect / totalPossible) * 100);

  let narrative = '';
  try {
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        messages: [{ role: 'user', content: `You are Hassan Awad, UK-qualified maths teacher (QTS), Madinah, 10+ years experience. Diagnosis-led method. Direct, warm, British English. No AI cliches.\n\nStudent: "${studentName}" (${yearGroup || 'year group not provided'})\nResults across 6 Edexcel GCSE topic areas:\n${scoreSummary}\nOverall: ${totalCorrect}/${totalPossible} (${overallPct}%)\n\nWrite a diagnostic summary for Hassan to use before a parent call. 3-4 paragraphs, no bullet points, no headers. Cover: overall level honestly, two weakest areas and why they matter, most foundational gap to fix first, 2-3 things to probe on the call, realistic prognosis.` }]
      })
    });
    const aiData = await aiResp.json();
    narrative = aiData.content?.find(b => b.type === 'text')?.text ?? 'AI narrative unavailable.';
  } catch {
    narrative = 'AI narrative could not be generated. Review raw scores below.';
  }

  const topicRows = testResults.map(tr => {
    const correct = tr.answers.filter(a => a.correct).length;
    const pct = Math.round((correct / tr.answers.length) * 100);
    const color = pct >= 70 ? '#1C7A47' : pct >= 45 ? '#C9922A' : '#B83232';
    return `<tr><td style="padding:6px 12px;font-size:14px;">${tr.label}</td><td style="padding:6px 12px;font-size:14px;font-weight:700;color:${color};">${correct}/${tr.answers.length}</td><td style="padding:6px 12px;font-size:14px;color:${color};">${pct}%</td></tr>`;
  }).join('');

  const breakdownHtml = testResults.map(tr => {
    const correct = tr.answers.filter(a => a.correct).length;
    const rows = tr.answers.map((a, i) => `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 12px;font-size:13px;color:#6b7280;">Q${i+1} Grade ${a.grade}</td><td style="padding:8px 12px;font-size:13px;">${a.text}</td><td style="padding:8px 12px;font-size:13px;text-align:center;">${a.correct ? 'PASS' : 'FAIL'}</td><td style="padding:8px 12px;font-size:12px;color:#6b7280;">${!a.correct ? (a.explanation || '') : ''}</td></tr>`).join('');
    return `<h3 style="font-size:15px;font-weight:700;color:#0D1B2A;margin:24px 0 8px;">${tr.label} - ${correct}/${tr.answers.length}</h3><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f9fafb;"><th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;">Q</th><th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;">Question</th><th style="padding:8px 12px;font-size:12px;text-align:center;color:#6b7280;">Result</th><th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;">Explanation</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');

  const emailHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',sans-serif;"><div style="max-width:700px;margin:40px auto;background:#ffffff;border-radius:10px;overflow:hidden;"><div style="background:#0D1B2A;padding:32px 40px;"><div style="font-size:22px;font-weight:900;color:#ffffff;">Awad<span style="color:#C9922A;">Maths</span></div><div style="font-size:13px;color:#8A9EAF;margin-top:4px;">Diagnostic Report - For Hassan Only</div></div><div style="padding:28px 40px;border-bottom:1px solid #e5e7eb;"><div style="font-size:20px;font-weight:700;color:#0D1B2A;">${studentName}</div><div style="font-size:14px;color:#6b7280;margin-top:4px;">${yearGroup || 'Year group not provided'} - ${new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}</div><div style="margin-top:16px;display:inline-block;background:#0D1B2A;color:#C9922A;font-size:28px;font-weight:900;padding:12px 28px;border-radius:8px;">${totalCorrect}/${totalPossible} <span style="font-size:15px;font-weight:400;color:#8A9EAF;">(${overallPct}%)</span></div></div><div style="padding:28px 40px;border-bottom:1px solid #e5e7eb;"><div style="font-size:14px;font-weight:700;color:#0D1B2A;margin-bottom:12px;">TOPIC BREAKDOWN</div><table style="width:100%;border-collapse:collapse;">${topicRows}</table></div><div style="padding:28px 40px;border-bottom:1px solid #e5e7eb;background:#fafafa;"><div style="font-size:14px;font-weight:700;color:#0D1B2A;margin-bottom:16px;">PRE-CALL ASSESSMENT</div>${narrative.split('\n\n').map(p => `<p style="font-size:15px;color:#1f2937;line-height:1.8;margin:0 0 14px;">${p}</p>`).join('')}</div><div style="padding:28px 40px;"><div style="font-size:14px;font-weight:700;color:#0D1B2A;margin-bottom:16px;">FULL QUESTION BREAKDOWN</div>${breakdownHtml}</div><div style="padding:20px 40px;background:#0D1B2A;text-align:center;"><div style="font-size:12px;color:#5F7285;">Awad Maths - Hassan Awad - Madinah</div></div></div></body></html>`;

  try {
    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAIL, subject: `Awad Maths Diagnostic - ${studentName} (${yearGroup || 'Year TBC'}) - ${totalCorrect}/${totalPossible}`, html: emailHtml })
    });
    if (!emailResp.ok) {
      const err = await emailResp.text();
      return new Response(JSON.stringify({ success: false, error: err }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}