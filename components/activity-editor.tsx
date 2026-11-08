"use client";
import { useState } from "react";
import {
  activityBundles,
  replaceActivityBundle,
  levelLabels,
  type Activity,
  type Report,
  type Skill,
} from "../lib/domain";
import SkillQuickAdd from "./skill-quick-add";
type Document = { id: string; name: string };
type Grid = {
  id: string;
  skills: Skill[];
  version?: number;
  validated?: number;
};
type Props = {
  report: Report;
  grid: Grid;
  documents: Document[];
  busy: boolean;
  onChange: (report: Report) => void;
  onUpload: (files: File[], bundleId: string) => Promise<void>;
  onAdded: (grid: Grid, skill: Skill, bundleId: string) => Promise<void>;
};
export default function ActivityEditor(props: Props) {
  const bundles = activityBundles(props.report.activities);
  return (
    <div className="activity-editor">
      {bundles.map((bundle, i) => (
        <ActivityCard key={bundle.id} {...props} bundle={bundle} index={i} />
      ))}
      <button
        type="button"
        className="button secondary full-width dashed"
        disabled={props.busy}
        onClick={() => {
          const workId = crypto.randomUUID();
          props.onChange({
            ...props.report,
            activities: [
              ...props.report.activities,
              {
                id: crypto.randomUUID(),
                workId,
                skillId: "",
                type: "td",
                level: null,
                confirmed: false,
                workRef: "",
                exercises: "",
                documentIds: [],
              },
            ],
          });
        }}
      >
        +{" "}
        {bundles.length ? "Ajouter une autre activité" : "Ajouter une activité"}
      </button>
    </div>
  );
}
function ActivityCard({
  report,
  grid,
  documents,
  busy,
  onChange,
  onUpload,
  onAdded,
  bundle,
  index,
}: Props & {
  bundle: ReturnType<typeof activityBundles>[number];
  index: number;
}) {
  const [search, setSearch] = useState("");
  const selected = new Set(
    bundle.activities.map((a) => a.skillId).filter(Boolean),
  );
  const groups = [
    ...new Set(report.skills.map((s) => s.group || "Autres compétences")),
  ];
  const matches = (s: Skill) =>
    (s.group + " " + s.label)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr")
      .includes(
        search
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("fr"),
      );
  function update(members: Activity[]) {
    const workId = bundle.activities[0].workId || crypto.randomUUID();
    onChange(
      replaceActivityBundle(
        report,
        bundle.id,
        members.map((a) => ({ ...a, workId })),
      ),
    );
  }
  function select(ids: string[], checked: boolean) {
    let members = bundle.activities.filter(
      (a) => a.skillId && (!ids.includes(a.skillId) || checked),
    );
    if (checked)
      for (const id of ids)
        if (!members.some((a) => a.skillId === id))
          members.push({
            ...bundle.activities[0],
            id: crypto.randomUUID(),
            skillId: id,
            level: null,
            confirmed: false,
          });
    if (!members.length)
      members = [
        { ...bundle.activities[0], skillId: "", level: null, confirmed: false },
      ];
    update(members);
  }
  return (
    <fieldset className="activity-fieldset bundled-activity">
      <legend>Activité {index + 1}</legend>
      <div className="activity-type-row">
        <div
          className="segmented"
          role="group"
          aria-label={"Type de l’activité " + (index + 1)}
        >
          {(
            [
              ["cours", "Cours"],
              ["td", "TD"],
              ["evaluation", "Évaluation"],
            ] as const
          ).map(([type, label]) => (
            <button
              type="button"
              key={type}
              disabled={busy}
              aria-pressed={bundle.type === type}
              className={bundle.type === type ? "selected" : ""}
              onClick={() =>
                update(bundle.activities.map((a) => ({ ...a, type })))
              }
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="text-button danger-icon"
          disabled={busy}
          onClick={() => onChange(replaceActivityBundle(report, bundle.id, []))}
          aria-label={"Retirer l’activité " + (index + 1)}
        >
          Retirer
        </button>
      </div>
      <label className="skill-search">
        Compétences travaillées
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une compétence"
        />
      </label>
      <div className="skill-picker">
        {groups.map((group) => {
          const skills = report.skills.filter(
            (s) => (s.group || "Autres compétences") === group && matches(s),
          );
          if (!skills.length) return null;
          const n = skills.filter((s) => selected.has(s.id)).length;
          return (
            <details className="skill-picker-group" key={group}>
              <summary>
                <span>{group}</span>
                <small>
                  {n} / {skills.length}
                </small>
              </summary>
              <div>
                <label className="checkbox-label select-all-skills">
                  <input
                    type="checkbox"
                    checked={skills.every((s) => selected.has(s.id))}
                    disabled={busy}
                    onChange={(e) =>
                      select(
                        skills.map((s) => s.id),
                        e.target.checked,
                      )
                    }
                  />
                  Tout sélectionner dans cette partie
                </label>
                {skills.map((skill) => (
                  <label className="checkbox-label skill-choice" key={skill.id}>
                    <input
                      type="checkbox"
                      checked={selected.has(skill.id)}
                      disabled={busy}
                      onChange={(e) => select([skill.id], e.target.checked)}
                    />
                    <span>
                      {skill.label}
                      {skill.origin === "teacher" && (
                        <small>Ajout du professeur</small>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </details>
          );
        })}
        {!report.skills.some(matches) && (
          <p className="hint">Aucune compétence trouvée.</p>
        )}
      </div>
      <div className="selected-skills-summary" aria-live="polite">
        {selected.size} compétence{selected.size !== 1 ? "s" : ""} sélectionnée
        {selected.size !== 1 ? "s" : ""}
      </div>
      <SkillQuickAdd
        chapterId={report.chapterId}
        grid={grid}
        initialGroup={
          report.skills.find((s) => selected.has(s.id))?.group || ""
        }
        onAdded={(next, skill) => onAdded(next, skill, bundle.id)}
      />
      <div className="activity-support">
        <h4>Support de l’activité</h4>
        {bundle.documentIds.map((id) => (
          <div className="activity-support-row" key={id}>
            <a href={"/api/documents/" + id} target="_blank" rel="noreferrer">
              {documents.find((d) => d.id === id)?.name || "Support PDF"}
            </a>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              aria-label={
                "Retirer le support " +
                (documents.find((d) => d.id === id)?.name || "PDF")
              }
              onClick={() =>
                update(
                  bundle.activities.map((a) => ({
                    ...a,
                    documentIds: bundle.documentIds.filter((d) => d !== id),
                  })),
                )
              }
            >
              Retirer
            </button>
          </div>
        ))}
        <label className="upload-label">
          {busy ? "Envoi en cours…" : "Joindre le support de l’activité"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={busy}
            onChange={(e) => {
              const files = [...(e.target.files || [])];
              e.target.value = "";
              void onUpload(files, bundle.id);
            }}
          />
        </label>
        {documents.some((d) => !bundle.documentIds.includes(d.id)) && (
          <label className="reuse-support">
            Réutiliser un support
            <select
              value=""
              disabled={busy}
              onChange={(e) => {
                if (e.target.value)
                  update(
                    bundle.activities.map((a) => ({
                      ...a,
                      documentIds: [...bundle.documentIds, e.target.value],
                    })),
                  );
              }}
            >
              <option value="">Choisir un support existant</option>
              {documents
                .filter((d) => !bundle.documentIds.includes(d.id))
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      {selected.size > 0 && (
        <details
          className="form-details activity-levels"
          open={bundle.activities.some((a) => a.level !== null) || undefined}
        >
          <summary>
            Maîtrise par compétence <span>facultatif</span>
          </summary>
          {bundle.activities
            .filter((a) => a.skillId)
            .map((a) => (
              <div className="notion-observation" key={a.id}>
                <h4>{report.skills.find((s) => s.id === a.skillId)?.label}</h4>
                <div
                  className="level-options"
                  role="group"
                  aria-label={
                    "Maîtrise : " +
                    report.skills.find((s) => s.id === a.skillId)?.label
                  }
                >
                  {[null, 0, 25, 50, 75, 100].map((level) => (
                    <button
                      type="button"
                      key={String(level)}
                      disabled={busy}
                      aria-pressed={a.level === level}
                      className={a.level === level ? "selected" : ""}
                      onClick={() =>
                        update(
                          bundle.activities.map((row) =>
                            row.id === a.id
                              ? { ...row, level, confirmed: false }
                              : row,
                          ),
                        )
                      }
                    >
                      {level === null ? "Non évaluée" : level + " %"}
                    </button>
                  ))}
                </div>
                <p className="level-explanation">
                  {levelLabels[a.level === null ? "none" : a.level]}
                </p>
                {a.level === 100 && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={a.confirmed}
                      disabled={busy}
                      onChange={(e) =>
                        update(
                          bundle.activities.map((row) =>
                            row.id === a.id
                              ? { ...row, confirmed: e.target.checked }
                              : row,
                          ),
                        )
                      }
                    />
                    Je confirme une réussite autonome sur un autre exercice ou
                    une autre séance.
                  </label>
                )}
              </div>
            ))}
        </details>
      )}
    </fieldset>
  );
}
