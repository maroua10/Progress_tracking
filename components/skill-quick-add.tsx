"use client";
import { useRef, useState } from "react";
import type { Skill } from "../lib/domain";
import { readJsonResponse } from "../lib/client-response";
type Grid = {
  id: string;
  skills: Skill[];
  version?: number;
  validated?: number;
};
export default function SkillQuickAdd({
  chapterId,
  grid,
  onAdded,
  initialGroup = "",
}: {
  chapterId: string;
  grid: Grid;
  onAdded: (grid: Grid, skill: Skill) => void | Promise<void>;
  initialGroup?: string;
}) {
  const [open, setOpen] = useState(false),
    [label, setLabel] = useState(""),
    [group, setGroup] = useState(initialGroup),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestKey = useRef("");
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    requestKey.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/chapters/" + chapterId + "/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseGridId: grid.id,
          skillId: requestKey.current,
          label,
          group: group || "Compétences complémentaires",
          validated: true,
        }),
      });
      const result = await readJsonResponse(response);
      if (!response.ok)
        throw new Error(result.error || "L’ajout n’a pas pu être enregistré.");
      await onAdded(result.grid, result.skill);
      setOpen(false);
      setLabel("");
      requestKey.current = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <button
        type="button"
        className="text-button add-skill-button"
        onClick={() => {
          setOpen(true);
          setGroup(initialGroup);
        }}
      >
        + Ajouter une compétence
      </button>
    );
  return (
    <div className="quick-skill-form">
      <h4>Nouvelle compétence</h4>
      <label>
        Grande compétence
        <input
          value={group}
          maxLength={120}
          placeholder="Ex. Fondamentaux du calcul algébrique"
          onChange={(e) => setGroup(e.target.value)}
          list={"skill-groups-" + grid.id}
        />
        <datalist id={"skill-groups-" + grid.id}>
          {[...new Set(grid.skills.map((s) => s.group).filter(Boolean))].map(
            (g) => (
              <option key={g} value={g} />
            ),
          )}
        </datalist>
      </label>
      <label>
        Petite compétence
        <input
          autoFocus
          value={label}
          maxLength={250}
          onChange={(e) => {
            setLabel(e.target.value);
            requestKey.current = "";
          }}
          placeholder="Ex. Réduire une expression littérale"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (label.trim()) void submit();
            }
          }}
        />
      </label>
      <p className="hint">
        Ajout du professeur, conservé dans la grille du chapitre.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button
          type="button"
          className="button small"
          disabled={busy || !label.trim()}
          onClick={() => void submit()}
        >
          {busy ? "Enregistrement…" : "Ajouter et valider"}
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
