"use client";
import { useState } from "react";
import { TEACH_QUESTIONS, previewTaught, TeachAnswers, emptyTeach } from "@/lib/teach";

/** «Enseña a tu empleado»: 5 preguntas → vista previa en palabras sencillas → guardar. Lo que se guarda lo vuelve a calcular el servidor. */
export function TeachForm({ action, hidden, employeeName, initial = emptyTeach }: { action: (f: FormData) => Promise<void>; hidden: Record<string, string>; employeeName: string; initial?: TeachAnswers }) {
  const [a, setA] = useState<TeachAnswers>(initial); const [preview, setPreview] = useState(false);
  const set = (k: keyof TeachAnswers, v: string) => setA((p) => ({ ...p, [k]: v }));
  const filled = Object.values(a).some((v) => v.trim());
  if (preview) return (<form action={action} data-testid="teach-preview">
    {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}{TEACH_QUESTIONS.map((q) => <input key={q.key} type="hidden" name={q.key} value={a[q.key]} />)}
    <h2>👀 Mira cómo quedará</h2><p className="lead">Esto es lo que {employeeName} aprenderá. Todavía no se guardó nada.</p>
    {previewTaught(a).map((p) => <div className="card" key={p.titulo} style={{ marginBottom: 10 }}><h3>{p.titulo}</h3><p style={{ whiteSpace: "pre-wrap" }}>{p.texto}</p></div>)}
    <div className="notice ok">🔒 Aunque aprenda cosas nuevas, <b>siempre te pedirá permiso</b> antes de publicar, enviar o cambiar algo importante.</div>
    <p className="row"><button className="big" data-testid="teach-save">Guardar lo que le enseñé</button><button type="button" className="ghost" onClick={() => setPreview(false)}>← Seguir editando</button></p></form>);
  return (<div data-testid="teach-form">
    {TEACH_QUESTIONS.map((q, i) => (<div key={q.key}><label htmlFor={`q-${q.key}`}>{i + 1}. {q.label}</label><span className="help">{q.help}</span>
      <textarea id={`q-${q.key}`} rows={q.key === "nunca" ? 3 : 2} value={a[q.key]} onChange={(e) => set(q.key, e.target.value)} placeholder={`Ejemplo: ${q.example}`} data-testid={`teach-${q.key}`} maxLength={1500} />
      {!a[q.key] && <button type="button" className="ghost" onClick={() => set(q.key, q.example)} style={{ marginTop: 4 }}>Usar el ejemplo</button>}</div>))}
    <p><button type="button" className="big" disabled={!filled} onClick={() => setPreview(true)} data-testid="teach-preview-btn">Ver cómo quedará →</button></p>
    {!filled && <p className="muted">Responde al menos una pregunta para ver la vista previa.</p>}</div>);
}
