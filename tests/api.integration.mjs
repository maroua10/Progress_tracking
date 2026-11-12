import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { PDFDocument } from "pdf-lib";
import { createHash } from "node:crypto";
const usePostgres=process.env.REPERE_TEST_POSTGRES === "1";
const built = await build({
  stdin: {
    contents: `import {handle,parentExchange,ApiError,json} from './lib/server.ts';export default {async fetch(r){try{const u=new URL(r.url);if(u.pathname.startsWith('/p/'))return parentExchange(r,u.pathname.split('/')[2]);return await handle(r,u.pathname.replace('/api/','').split('/'));}catch(e){return json({error:e.message},e instanceof ApiError?e.status:500)}}}`,
    resolveDir: process.cwd(),
  },
  plugins: [{ name: "test-worker-runtime", setup(b) { b.onResolve({ filter: /^\.\/runtime$/ }, () => ({ path: new URL(usePostgres?"./postgres-runtime.ts":"./worker-runtime.ts", import.meta.url).pathname })); } }],
  bundle: true,
  format: "esm",
  platform: "neutral",
  mainFields: ["module", "main"],
  external: ["cloudflare:workers"],
  write: false,
});
const mf = usePostgres ? await (await import("./postgres-fixture.mjs")).postgresFixture(built.outputFiles[0].text) : new Miniflare({
  modules: true,
  script: built.outputFiles[0].text,
  compatibilityDate: "2026-05-15",
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
});
const db = await mf.getD1Database("DB");
for (const file of (usePostgres?[]:await readdir("drizzle"))
  .filter((x) => x.endsWith(".sql"))
  .sort()) {
  const sql = await readFile("drizzle/" + file, "utf8");
  for (const stmt of sql
    .split("--> statement-breakpoint")
    .map((x) => x.trim())
    .filter(Boolean))
    await db.prepare(stmt).run();
}
async function call(path, method = "GET", data, auth = "teacher", extra = {}) {
  const headers = { Origin: "http://orbite.test", ...extra };
  if (auth === "teacher") headers["oai-authenticated-user-id"] = "test-teacher";
  if (auth === "other") headers["oai-authenticated-user-id"] = "intruder";
  if (auth?.startsWith("orbite_parent=")) headers.Cookie = auth;
  const init = { method, headers };
  if (data) {
    if (data instanceof FormData) {
      const encoded = new Request("http://orbite.test", {
        method: "POST",
        body: data,
      });
      headers["Content-Type"] = encoded.headers.get("content-type");
      init.body = new Uint8Array(await encoded.arrayBuffer());
    } else {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(data);
    }
  }
  const response = await mf.dispatchFetch(
    "http://orbite.test/api/" + path,
    init,
  );
  let result;
  try {
    result = await response.clone().json();
  } catch {}
  return { response, status: response.status, data: result };
}
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris"}).format(new Date());
function dateOfNextRegular(date){const d=new Date(date+"T12:00:00Z"),day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()-day+3);return d.toISOString().slice(0,10);}
let session, report, parentCookie, grantId, pdfId, firstPdfBytes;
async function pdfText(bytes) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(bytes) });
  const pdf = await task.promise;
  const parts = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    parts.push(
      (await page.getTextContent()).items.map((i) => i.str || "").join(" "),
    );
  }
  await task.destroy();
  return parts.join("\n").replace(/\s+/g, " ");
}
test(usePostgres?"API complète sur PostgreSQL isolé — aucune donnée réelle":"API complète sur D1 et R2 isolés — aucune donnée réelle", async (t) => {
  try {
    await t.test(
      "anonyme et autre utilisateur refusés, initialisation protégée",
      async () => {
        assert.equal(
          (
            await call(
              "setup",
              "POST",
              { name: "TEST — données isolées" },
              null,
            )
          ).status,
          401,
        );
        assert.equal(
          (await call("setup", "POST", { name: "TEST — données isolées" }))
            .status,
          200,
        );
        assert.equal((await call("data", "GET", null, "other")).status, 403);
        assert.equal((await call("data", "GET", null, null)).status, 401);
      },
    );
    await t.test(
      "préparation idempotente, aucun bilan ni maîtrise inventés",
      async () => {
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Paris",
        }).format(new Date());
        assert.equal((await call("prepare", "POST", { date })).status, 200);
        await call("prepare", "POST", { date });
        const result = await call("data");
        assert.equal(result.data.sessions.length, 3);
        assert.equal(result.data.reports.length, 0);
        assert.equal(
          result.data.chapters.find((c) => c.id === "suites").metrics.mastery,
          null,
        );
        session = result.data.sessions[0];
      },
    );
    await t.test(
      "déplacement, annulation et réactivation sans nouveau créneau",
      async () => {
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Paris",
        }).format(new Date());
        let editor = (await call("sessions/" + session.id)).data;
        assert.equal(
          (
            await call("sessions/" + session.id + "/schedule", "POST", {
              date,
              status: "cancelled",
              version: editor.session.version,
            })
          ).status,
          200,
        );
        await call("prepare", "POST", { date });
        assert.equal((await call("data")).data.sessions.length, 3);
        editor = (await call("sessions/" + session.id)).data;
        assert.equal(editor.session.status, "cancelled");
        assert.equal(
          (
            await call("sessions/" + session.id + "/schedule", "POST", {
              date,
              status: "planned",
              version: editor.session.version,
            })
          ).status,
          200,
        );
        assert.equal((await call("data")).data.sessions.length, 3);
      },
    );
    await t.test(
      "validation de grille et brouillon privé persistent",
      async () => {
        let data = (await call("data")).data;
        const c = data.chapters.find((c) => c.id === "suites");
        assert.equal(
          (
            await call("chapters/suites/grid", "POST", {
              baseGridId: c.grid.id,
              skills: c.grid.skills,
              validated: true,
            })
          ).status,
          200,
        );
        data = (await call("data")).data;
        const grid = data.chapters.find((c) => c.id === "suites").grid;
        const editor = (await call("sessions/" + session.id)).data;
        report = {
          ...editor.draft,
          gridId: grid.id,
          skills: grid.skills,
          title: "TEST Bilan",
          privateNote: "SECRET PROFESSEUR",
          activities: [
            {
              id: "a",
              skillId: grid.skills[0].id,
              type: "td",
              level: null,
              confirmed: false,
              workRef: "TD A",
              exercises: "1,2",
            },
          ],
          comment: "Commentaire partagé",
        };
        const saved = await call("sessions/" + session.id + "/draft", "PUT", {
          report,
          version: editor.session.version,
        });
        assert.equal(saved.status, 200);
        session.version = saved.data.version;
        assert.equal(
          (await call("sessions/" + session.id)).data.draft.privateNote,
          "SECRET PROFESSEUR",
        );
        assert.equal(
          (
            await call("sessions/" + session.id + "/draft", "PUT", {
              report,
              version: 0,
            })
          ).status,
          409,
        );
      },
    );
    await t.test("lien parent à 256 bits, jeton invalide refusé", async () => {
      const grant = await call("grants", "POST", { label: "TEST Parent" });
      assert.match(grant.data.url, /\/p\/[a-f0-9]{64}$/);
      const exchange = await mf.dispatchFetch(grant.data.url, {
        redirect: "manual",
      });
      assert.equal(exchange.status, 303);
      parentCookie = exchange.headers.get("set-cookie").split(";")[0];
      assert.match(exchange.headers.get("set-cookie"), /HttpOnly/);
      assert.equal(
        (await mf.dispatchFetch("http://orbite.test/p/" + "0".repeat(64)))
          .status,
        403,
      );
      grantId = (await call("data")).data.grants[0].id;
    });
    await t.test(
      "parent ne voit ni brouillon ni note privée ; mutations et export interdits",
      async () => {
        const result = await call("data", "GET", null, parentCookie);
        assert.equal(result.status, 200);
        assert.equal(result.data.reports.length, 0);
        assert.ok(!JSON.stringify(result.data).includes("SECRET"));
        assert.ok(!JSON.stringify(result.data).includes("TEST Bilan"));
        for (const [path, method, body] of [
          ["sessions", "POST", { date: report.date, chapterId: "suites" }],
          ["sessions/" + session.id, "GET"],
          ["export", "GET"],
          ["grants", "POST", {}],
          ["student", "PUT", { name: "Attaque" }],
        ])
          assert.equal(
            (await call(path, method, body, parentCookie)).status,
            403,
            path,
          );
      },
    );
    await t.test(
      "PDF durable, contrôlé et privé avant publication",
      async () => {
        const form = new FormData();
        form.append("sessionId", session.id);
        form.append(
          "file",
          new File(["%PDF-1.4\nTEST\n%%EOF"], "test.pdf", {
            type: "application/pdf",
          }),
        );
        const uploaded = await call("documents", "POST", form);
        assert.equal(uploaded.status, 201, JSON.stringify(uploaded.data));
        pdfId = uploaded.data.id;
        assert.equal((await call("documents/" + pdfId)).status, 200);
        assert.equal(
          (await call("documents/" + pdfId, "GET", null, parentCookie)).status,
          403,
        );
        const spoof = new FormData();
        spoof.append("sessionId", session.id);
        spoof.append("file", new File(["<script>invalid</script>"], "bad.pdf"));
        assert.equal((await call("documents", "POST", spoof)).status, 400);
        report.documentIds = [pdfId];
        const saved = await call("sessions/" + session.id + "/draft", "PUT", {
          report,
          version: session.version,
        });
        session.version = saved.data.version;
      },
    );
    await t.test(
      "publication idempotente et non évalué distinct de 0",
      async () => {
        const body = {
          version: session.version,
          requestKey: "publish-test-1",
          reason: "",
        };
        const p = await call(
          "sessions/" + session.id + "/publish",
          "POST",
          body,
        );
        assert.equal(p.status, 200, JSON.stringify(p.data));
        assert.equal(
          (await call("sessions/" + session.id + "/publish", "POST", body))
            .status,
          200,
        );
        const data = (await call("data", "GET", null, parentCookie)).data;
        assert.equal(data.reports.length, 1);
        assert.equal(data.revisions.length, 1);
        assert.ok(!JSON.stringify(data).includes("SECRET"));
        const link = data.reports[0].pdf;
        assert.match(link.url, /\/api\/reports\/.+\/pdf\?revision=1$/);
        assert.equal(link.sessionId, session.id);
        const file = await call(
          link.url.replace("/api/", ""),
          "GET",
          null,
          parentCookie,
        );
        assert.equal(file.status, 200);
        assert.match(
          file.response.headers.get("content-type"),
          /application\/pdf/,
        );
        firstPdfBytes = new Uint8Array(await file.response.arrayBuffer());
        assert.ok(firstPdfBytes.length < 600000);
        const pdf = await PDFDocument.load(firstPdfBytes);
        assert.match(pdf.getTitle(), /TEST Bilan/);
        assert.ok(pdf.getPageCount() >= 1);
        const text = await pdfText(firstPdfBytes);
        assert.ok(text.includes("TEST Bilan"));
        assert.ok(text.includes("Suites numériques"));
        assert.ok(text.includes("TD A"));
        assert.ok(text.includes("Non évaluée"));
        assert.ok(!text.includes("SECRET"));
        assert.ok(!text.includes("Note privée"));
        const stored = await db.prepare("SELECT * FROM report_pdfs").all();
        assert.equal(stored.results.length, 1);
        assert.equal(
          stored.results[0].sha256,
          createHash("sha256").update(firstPdfBytes).digest("hex"),
        );
        assert.equal(
          (await call("reports/" + session.id + "/pdf", "GET", null, null))
            .status,
          401,
        );
        assert.equal(
          (
            await call(
              "reports/" + session.id + "/pdf?revision=999",
              "GET",
              null,
              parentCookie,
            )
          ).status,
          404,
        );
        const m = data.chapters.find((c) => c.id === "suites").metrics;
        assert.equal(m.sessions, 1);
        assert.equal(m.evaluated, 0);
        assert.equal(m.mastery, null);
        assert.equal(m.tds, 1);
        assert.equal(m.exercises, 2);
        assert.equal(
          (await call("documents/" + pdfId, "GET", null, parentCookie)).status,
          200,
        );
      },
    );
    await t.test(
      "modification distincte de la publication et versions conservées",
      async () => {
        let e = (await call("sessions/" + session.id)).data;
        report = {
          ...e.draft,
          title: "TEST Corrigé",
          activities: [{ ...e.draft.activities[0], level: 75 }],
        };
        const saved = await call("sessions/" + session.id + "/draft", "PUT", {
          report,
          version: e.session.version,
        });
        session.version = saved.data.version;
        assert.equal(
          (await call("data", "GET", null, parentCookie)).data.reports[0]
            .payload.title,
          "TEST Bilan",
        );
        assert.equal(
          (
            await call("sessions/" + session.id + "/publish", "POST", {
              version: session.version,
              requestKey: "publish-test-2",
            })
          ).status,
          409,
        );
        const pub = await call("sessions/" + session.id + "/update", "POST", {
          version: session.version,
          requestKey: "publish-test-2",
          reason: "Correction du niveau",
        });
        assert.equal(pub.status, 200);
        const d = (await call("data", "GET", null, parentCookie)).data;
        assert.equal(d.revisions.length, 2);
        assert.equal(d.reports.length, 1);
        assert.equal(d.reports[0].seq, 2);
        const updated = await call(
          "reports/" + session.id + "/pdf?revision=2",
          "GET",
          null,
          parentCookie,
        );
        assert.equal(updated.status, 200);
        const currentBytes = new Uint8Array(
          await updated.response.arrayBuffer(),
        );
        const currentText = await pdfText(currentBytes);
        assert.ok(currentText.includes("TEST Corrigé"));
        assert.ok(currentText.includes("75 %"));
        assert.ok(!currentText.includes("SECRET"));
        const original = await call(
          "reports/" + session.id + "/pdf?revision=1",
          "GET",
          null,
          parentCookie,
        );
        assert.deepEqual(
          new Uint8Array(await original.response.arrayBuffer()),
          firstPdfBytes,
        );
        assert.notEqual(
          createHash("sha256").update(currentBytes).digest("hex"),
          createHash("sha256").update(firstPdfBytes).digest("hex"),
        );
        assert.equal(
          (
            await call(
              "reports/" + session.id + "/pdf?revision=0",
              "GET",
              null,
              parentCookie,
            )
          ).status,
          400,
        );

        assert.equal(d.revisions[0].payload.activities[0].level, null);
        assert.equal(
          d.chapters.find((c) => c.id === "suites").metrics.mastery,
          75,
        );
      },
    );
    await t.test(
      "clôture et réouverture sans modifier les niveaux",
      async () => {
        assert.equal(
          (
            await call("chapters/suites/state", "POST", {
              state: "closed",
              note: "TEST Clôture",
            })
          ).status,
          200,
        );
        let c = (await call("data")).data.chapters.find(
          (c) => c.id === "suites",
        );
        assert.equal(c.state, "closed");
        assert.equal(c.metrics.mastery, 75);
        assert.equal(
          (
            await call("chapters/suites/state", "POST", {
              state: "revision",
              note: "TEST Révision",
            })
          ).status,
          200,
        );
        c = (await call("data")).data.chapters.find((c) => c.id === "suites");
        assert.equal(c.state, "revision");
        assert.equal(c.metrics.mastery, 75);
      },
    );
    await t.test(
      "origine externe refusée et révocation effective sur données et PDF",
      async () => {
        assert.equal(
          (
            await call("grants", "POST", {}, "teacher", {
              Origin: "http://attacker.test",
            })
          ).status,
          403,
        );
        assert.equal((await call("grants/" + grantId, "DELETE")).status, 200);
        assert.equal(
          (await call("data", "GET", null, parentCookie)).status,
          401,
        );
        assert.equal(
          (await call("documents/" + pdfId, "GET", null, parentCookie)).status,
          401,
        );
        assert.equal(
          (
            await call(
              "reports/" + session.id + "/pdf?revision=2",
              "GET",
              null,
              parentCookie,
            )
          ).status,
          401,
        );
        const exported = await call("export");
        assert.equal(exported.status, 200);
        assert.equal(exported.data.format, "orbite-export-v1");
        assert.equal(exported.data.revisions.length, 2);
      },
    );
    await t.test(
      "publications concurrentes atomiques et 100 % confirmé",
      async () => {
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Paris",
        }).format(new Date());
        const created = await call("sessions", "POST", {
          date,
          chapterId: "suites",
        });
        const id = created.data.id;
        const g = (await call("sessions/" + id)).data.draft;
        const report = {
          ...g,
          title: "TEST Concurrence",
          activities: [
            {
              id: "confirmed",
              skillId: g.skills[0].id,
              type: "cours",
              level: 100,
              confirmed: true,
              workRef: "",
              exercises: "Autre exercice confirmé",
            },
          ],
        };
        const saved = await call("sessions/" + id + "/draft", "PUT", {
          report,
          version: 0,
        });
        const attempts = await Promise.all(
          ["concurrent-a", "concurrent-b"].map((requestKey) =>
            call("sessions/" + id + "/publish", "POST", {
              version: saved.data.version,
              requestKey,
            }),
          ),
        );
        assert.deepEqual(
          attempts.map((x) => x.status).sort(),
          [200, 409],
          JSON.stringify(attempts.map((x) => x.data)),
        );
        const editor = (await call("sessions/" + id)).data;
        assert.equal(editor.revisions.length, 1);
        assert.equal(editor.revisions[0].payload.activities[0].level, 100);
        assert.equal(editor.revisions[0].payload.activities[0].confirmed, true);
        const chapter = (await call("data")).data.chapters.find(
          (c) => c.id === "suites",
        );
        assert.equal(
          chapter.finalMetrics.mastery,
          75,
          "Le bilan de clôture reste figé après une nouvelle observation",
        );
        assert.equal(chapter.metrics.mastery, 100);
        const priorGridId = editor.revisions[0].payload.gridId;
        const editedSkills = chapter.grid.skills.map((s, i) =>
          i === 0 ? { ...s, label: s.label + " — précision" } : s,
        );
        assert.equal(
          (
            await call("chapters/suites/grid", "POST", {
              baseGridId: chapter.grid.id,
              skills: editedSkills,
              validated: true,
            })
          ).status,
          200,
        );
        const unchanged = (await call("sessions/" + id)).data.revisions[0]
          .payload;
        assert.equal(unchanged.gridId, priorGridId);
        assert.equal(unchanged.skills[0].label, g.skills[0].label);
      },
    );

    await t.test(
      "référentiel téléchargé authentifié et octets exacts",
      async () => {
        const id = "programme-officiel-2026";
        assert.equal(
          (await call("documents/" + id, "GET", null, null)).status,
          401,
        );
        const result = await call("documents/" + id);
        assert.equal(result.status, 200);
        const bytes = new Uint8Array(await result.response.arrayBuffer());
        assert.equal(bytes.length, 354852);
        const { createHash } = await import("node:crypto");
        assert.equal(
          createHash("sha256").update(bytes).digest("hex"),
          "5303df0fcf6335f06d00c969a61dcd82cc3fdfd105271ae5c2ef580ff49b6c08",
        );
        const preview = await call("documents/" + id + "?view=1");
        assert.match(
          preview.response.headers.get("content-disposition"),
          /^inline/,
        );
        assert.match(
          preview.response.headers.get("content-security-policy"),
          /sandbox/,
        );
      },
    );
    await t.test(
      "lecture individuelle, correction non vue et historique global",
      async () => {
        const grant = await call("grants", "POST", {
          label: "TEST Parent lecture",
        });
        const exchange = await mf.dispatchFetch(grant.data.url, {
          redirect: "manual",
        });
        parentCookie = exchange.headers.get("set-cookie").split(";")[0];
        const before = (await call("data", "GET", null, parentCookie)).data;
        assert.ok(before.historyReports.length >= 2);
        assert.equal(
          before.historyReports.find((r) => r.session_id === session.id).viewed,
          false,
        );
        assert.equal(
          (
            await call(
              "reports/" + session.id + "/view",
              "POST",
              { seq: 2 },
              parentCookie,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await call("data", "GET", null, parentCookie)
          ).data.historyReports.find((r) => r.session_id === session.id).viewed,
          true,
        );
        assert.equal(
          (await call("data")).data.historyReports.find(
            (r) => r.session_id === session.id,
          ).viewed,
          false,
        );
        assert.equal(
          (
            await call(
              "reports/" + session.id + "/view",
              "POST",
              { seq: 99 },
              parentCookie,
            )
          ).status,
          400,
        );
        const old = (
          await call("data?date=2026-01-01", "GET", null, parentCookie)
        ).data;
        assert.equal(old.reports.length, 0);
        assert.ok(old.historyReports.length >= 2);
        assert.equal(
          old.chapters.find((c) => c.id === "suites").metrics.mastery,
          null,
        );
        const c = (await call("data")).data.chapters.find(
          (c) => c.id === "suites",
        );
        assert.equal(c.grid.skills.length, 30);
        assert.ok(c.grid.skills.every((s) => s.group));
        assert.ok(c.grid.skills.some((s) => s.id === "su-algo-seuil"));
      },
    );
    await t.test(
      "suppression/restauration de bilan : recalcul et contrôle parent",
      async () => {
        const before = (await call("data")).data;
        const target = before.historyReports.find(
          (r) => r.payload.title === "TEST Concurrence",
        );
        assert.equal(
          (
            await call(
              "reports/" + target.session_id,
              "DELETE",
              null,
              parentCookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (await call("trash", "GET", null, parentCookie)).status,
          403,
        );
        assert.equal(
          (await call("reports/" + target.session_id, "DELETE")).status,
          200,
        );
        const after = (await call("data", "GET", null, parentCookie)).data;
        assert.equal(
          after.chapters.find((c) => c.id === "suites").metrics.mastery,
          75,
        );
        assert.ok(
          !after.historyReports.some((r) => r.session_id === target.session_id),
        );
        assert.ok(
          !after.revisions.some((r) => r.session_id === target.session_id),
        );
        assert.equal(
          (
            await call(
              "reports/" + target.session_id + "/view",
              "POST",
              { seq: 1 },
              parentCookie,
            )
          ).status,
          404,
        );
        assert.equal((await call("sessions/" + target.session_id)).status, 410);
        assert.ok(
          (await call("trash")).data.reports.some(
            (r) => r.session_id === target.session_id,
          ),
        );
        assert.equal(
          (
            await call(
              "reports/" + target.session_id + "/restore",
              "POST",
              null,
              parentCookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (await call("reports/" + target.session_id + "/restore", "POST"))
            .status,
          200,
        );
        const restored = (await call("data")).data;
        assert.equal(
          restored.chapters.find((c) => c.id === "suites").metrics.mastery,
          100,
        );
        assert.equal(
          restored.historyReports.length,
          before.historyReports.length,
        );
        assert.equal(
          restored.chapters.find((c) => c.id === "suites").finalMetrics.mastery,
          75,
        );
      },
    );
    await t.test(
      "corbeille de PDF : accès retiré, fichier conservé puis restauré",
      async () => {
        assert.equal(
          (await call("documents/" + pdfId, "DELETE", null, parentCookie))
            .status,
          403,
        );
        assert.equal((await call("documents/" + pdfId, "DELETE")).status, 200);
        assert.equal(
          (await call("documents/" + pdfId, "GET", null, parentCookie)).status,
          410,
        );
        assert.ok(
          !(await call("data", "GET", null, parentCookie)).data.documents.some(
            (d) => d.id === pdfId,
          ),
        );
        assert.ok(
          (await call("trash")).data.documents.some((d) => d.id === pdfId),
        );
        assert.equal(
          (await call("documents/" + pdfId + "/restore", "POST")).status,
          200,
        );
        assert.equal(
          (await call("documents/" + pdfId, "GET", null, parentCookie)).status,
          200,
        );
        assert.equal(
          (await call("documents/programme-officiel-2026", "DELETE")).status,
          200,
        );
        assert.equal(
          (
            await call(
              "documents/programme-officiel-2026",
              "GET",
              null,
              parentCookie,
            )
          ).status,
          410,
        );
        assert.equal(
          (await call("documents/programme-officiel-2026/restore", "POST"))
            .status,
          200,
        );
        assert.equal(
          (
            await call(
              "documents/programme-officiel-2026",
              "GET",
              null,
              parentCookie,
            )
          ).status,
          200,
        );
        const exported = (await call("export")).data;
        assert.ok(exported.resource_events.length >= 6);
        assert.equal(exported.revisions.length, 3);
      },
    );
    await t.test(
      "adoption d’une grille détaillée sans réécriture des bilans",
      async () => {
        const before = (await call("data")).data;
        const c = before.chapters.find((c) => c.id === "suites");
        const prior = before.historyReports.map((r) => ({
          id: r.id,
          grid: r.payload.gridId,
          skills: JSON.stringify(r.payload.skills),
        }));
        assert.equal(
          (
            await call(
              "chapters/suites/refine",
              "POST",
              { baseGridId: c.grid.id },
              parentCookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call("chapters/suites/refine", "POST", {
              baseGridId: c.grid.id,
            })
          ).status,
          200,
        );
        const after = (await call("data")).data;
        const next = after.chapters.find((c) => c.id === "suites");
        assert.equal(next.grid.version, c.grid.version + 1);
        assert.equal(next.grid.validated, 0);
        assert.equal(next.grid.skills.length, 30);
        assert.deepEqual(
          after.historyReports.map((r) => ({
            id: r.id,
            grid: r.payload.gridId,
            skills: JSON.stringify(r.payload.skills),
          })),
          prior,
        );
      },
    );
    await t.test(
      "première publication unique, modification sans republication et PDF mis à jour",
      async () => {
        const target = (await call("data")).data.historyReports.find(
          (r) => r.payload.title === "TEST Concurrence",
        );
        const original = await call(
          "reports/" + target.session_id + "/pdf?revision=1",
          "GET",
          null,
          parentCookie,
        );
        const originalBytes = new Uint8Array(
          await original.response.arrayBuffer(),
        );
        const editor = (await call("sessions/" + target.session_id)).data;
        const draft = {
          ...editor.draft,
          title: "TEST Modification depuis le bouton Modifier",
          comment: "Commentaire public modifié",
          privateNote: "SECRET APRÈS MODIFICATION",
        };
        const saved = await call(
          "sessions/" + target.session_id + "/draft",
          "PUT",
          { report: draft, version: editor.session.version },
        );
        const pub = await call(
          "sessions/" + target.session_id + "/publish",
          "POST",
          {
            version: saved.data.version,
            requestKey: "unwanted-second-publication",
          },
        );
        assert.equal(pub.status, 409);
        assert.equal(
          (
            await call(
              "sessions/" + target.session_id + "/update",
              "POST",
              { version: saved.data.version, requestKey: "update-report-2" },
              parentCookie,
            )
          ).status,
          403,
        );
        const changed = await call(
          "sessions/" + target.session_id + "/update",
          "POST",
          { version: saved.data.version, requestKey: "update-report-2" },
        );
        assert.equal(changed.status, 200);
        assert.equal(changed.data.seq, 2);
        assert.equal(
          (
            await call("sessions/" + target.session_id + "/update", "POST", {
              version: saved.data.version,
              requestKey: "update-report-2",
            })
          ).status,
          200,
        );
        const bytes = new Uint8Array(
          await (
            await call(
              "reports/" + target.session_id + "/pdf",
              "GET",
              null,
              parentCookie,
            )
          ).response.arrayBuffer(),
        );
        const text = await pdfText(bytes);
        assert.ok(text.includes("TEST Modification depuis le bouton Modifier"));
        assert.ok(text.includes("Commentaire public modifié"));
        assert.ok(!text.includes("SECRET"));
        assert.deepEqual(
          new Uint8Array(
            await (
              await call(
                "reports/" + target.session_id + "/pdf?revision=1",
                "GET",
                null,
                parentCookie,
              )
            ).response.arrayBuffer(),
          ),
          originalBytes,
        );
        const count = await db
          .prepare(
            "SELECT COUNT(*) AS count FROM report_pdfs WHERE revision_id IN (SELECT id FROM revisions WHERE session_id=?)",
          )
          .bind(target.session_id)
          .first();
        assert.equal(count.count, 2);
      },
    );
    await t.test(
      "création rétroactive pour un ancien bilan et absence de doublons de fichiers",
      async () => {
        const rev = await db
          .prepare("SELECT id FROM revisions WHERE session_id=? AND seq=1")
          .bind(session.id)
          .first();
        const old = await db
          .prepare("SELECT * FROM report_pdfs WHERE revision_id=?")
          .bind(rev.id)
          .first();
        const bucket = await mf.getR2Bucket("BUCKET");
        await bucket.delete(old.storage_key);
        await db
          .prepare("DELETE FROM report_pdfs WHERE id=?")
          .bind(old.id)
          .run();
        const response = await call(
          "reports/" + session.id + "/pdf?revision=1",
          "GET",
          null,
          parentCookie,
        );
        assert.equal(response.status, 200);
        assert.ok(
          (
            await pdfText(new Uint8Array(await response.response.arrayBuffer()))
          ).includes("TEST Bilan"),
        );
        const cached = await db
          .prepare(
            "SELECT COUNT(*) AS count FROM report_pdfs WHERE revision_id=?",
          )
          .bind(rev.id)
          .first();
        assert.equal(cached.count, 1);
        const files = await bucket.list({ prefix: "report-pdfs/" });
        const metadata = await db
          .prepare("SELECT COUNT(*) AS count FROM report_pdfs")
          .first();
        assert.equal(files.objects.length, metadata.count);
      },
    );
    await t.test("résultats et durées conservés dans le bilan, le PDF et les statistiques", async () => {
      const target=(await call("data")).data.historyReports[0];
      const editor=(await call("sessions/"+target.session_id)).data;
      const performances=[{id:"chrono-1",title:"TEST TD chronométré",type:"td",score:7,scale:10,minutes:18}];
      const saved=await call("sessions/"+target.session_id+"/draft","PUT",{report:{...editor.draft,performances},version:editor.session.version});
      assert.equal(saved.status,200);
      const changed=await call("sessions/"+target.session_id+"/update","POST",{version:saved.data.version,requestKey:"timed-result"});
      assert.equal(changed.status,200);
      const parent=(await call("data","GET",null,parentCookie)).data;
      assert.equal(parent.historyReports.find(r=>r.session_id===target.session_id).payload.performances[0].minutes,18);
      const pdf=await call("reports/"+target.session_id+"/pdf");
      const text=await pdfText(new Uint8Array(await pdf.response.arrayBuffer()));
      assert.ok(text.includes("18 min"));assert.ok(text.includes("7 / 10"));
      const bad=await call("sessions/"+target.session_id+"/draft","PUT",{report:{...editor.draft,performances:[{...performances[0],minutes:-1}]},version:saved.data.version+1});
      assert.equal(bad.status,400);
    });
    await t.test("bilans de clôture PDF : droits, conservation, graphiques et historique partiel", async () => {
      const data=(await call("data")).data;
      const archived=data.chapterReports.find(d=>d.chapterId==='suites');
      assert.ok(archived);
      const path=archived.url.replace('/api/','');
      assert.equal((await call(path,'GET',null,null)).status,401);
      assert.equal((await call(path,'GET',null,'other')).status,403);
      assert.equal((await call('chapters/inconnu/summary')).status,404);
      const downloaded=await call(path,'GET',null,parentCookie);
      assert.equal(downloaded.status,200);
      const bytes=new Uint8Array(await downloaded.response.arrayBuffer());
      const doc=await PDFDocument.load(bytes);assert.ok(doc.getPageCount()>=2);
      const content=await pdfText(bytes);
      for(const label of ['Bilan du chapitre','Les résultats des contrôles','Parcours pédagogique','Synthèse des compétences']) assert.ok(content.includes(label),label);
      assert.ok(!content.includes('SECRET'));
      const metadata=await db.prepare('SELECT * FROM chapter_reports WHERE id=?').bind(archived.id).first();
      assert.equal(metadata.size,bytes.length);assert.equal(metadata.sha256,createHash('sha256').update(bytes).digest('hex'));
      assert.ok(!metadata.payload.includes('privateNote'));
      const grant=await call('grants','POST',{label:'TEST révocation synthèse'});
      const exchange=await mf.dispatchFetch(grant.data.url,{redirect:'manual'});
      const cookie=exchange.headers.get('set-cookie').split(';')[0];
      assert.equal((await call(path,'GET',null,cookie)).status,200);
      const allGrants=(await call('data')).data.grants;const newGrant=allGrants.find(g=>g.label==='TEST révocation synthèse');
      await call('grants/'+newGrant.id,'DELETE');
      assert.equal((await call(path,'GET',null,cookie)).status,401);

      const currentPath='chapters/'+archived.chapterId+'/summary?current=1';
      assert.equal((await call(currentPath,'GET',null,null)).status,401);
      const current=await call(currentPath,'GET',null,parentCookie);assert.equal(current.status,200);
      const currentText=await pdfText(new Uint8Array(await current.response.arrayBuffer()));assert.ok(currentText.includes('Synthèse des compétences'));assert.ok(currentText.includes('Parcours pédagogique'));assert.ok(!currentText.includes('SECRET'));
      const again=await call(path);assert.deepEqual(new Uint8Array(await again.response.arrayBuffer()),bytes);
      // A new layout uses the frozen observations and leaves the original PDF intact.
      const originalPath='chapters/'+archived.chapterId+'/summary?closure='+archived.id;
      assert.deepEqual(new Uint8Array(await(await call(originalPath)).response.arrayBuffer()),bytes);
      const bucket=await mf.getR2Bucket('BUCKET');
      const files=await bucket.list({prefix:'chapter-reports/eleve/'+archived.id+'/layout-'});
      assert.equal(files.objects.length,1);await bucket.delete(files.objects[0].key);
      const replacement=await call(path,'GET',null,parentCookie);assert.equal(replacement.status,200);
      const frozenText=await pdfText(new Uint8Array(await replacement.response.arrayBuffer()));assert.ok(!frozenText.includes('SECRET'));
      const afterLayout=await db.prepare('SELECT * FROM chapter_reports WHERE id=?').bind(archived.id).first();
      assert.equal(afterLayout.storage_key,metadata.storage_key);assert.equal(afterLayout.sha256,metadata.sha256);assert.equal(afterLayout.payload,metadata.payload);
      assert.deepEqual(new Uint8Array(await(await call(originalPath)).response.arrayBuffer()),bytes);
      const partial=data.chapterReports.find(d=>d.chapterId==='second-degre');
      assert.ok(partial);if(partial){const result=await call(partial.url.replace('/api/',''));assert.equal(result.status,200);const text=await pdfText(new Uint8Array(await result.response.arrayBuffer()));assert.ok(text.includes('date non renseignée'));}
    });
    await t.test("correction du bilan de chapitre : édition persistante, idempotence et original conservé",async()=>{
      const data=(await call('data')).data,entry=data.chapterReports.find(c=>c.chapterId==='suites'&&c.closedAt);
      const original=await db.prepare('SELECT * FROM chapter_reports WHERE id=?').bind(entry.id).first();
      const input={closureId:entry.id,requestKey:'test-editorial-correction',reason:'TEST précision pédagogique'};
      assert.equal((await call('chapters/suites/summary','POST',input,parentCookie)).status,403);
      assert.equal((await call('chapters/suites/summary','POST',{...input,reason:''})).status,400);
      const first=await call('chapters/suites/summary','POST',input);assert.equal(first.status,200);
      assert.equal((await call('chapters/suites/summary','POST',input)).data.id,first.data.id);
      const edition=await db.prepare('SELECT * FROM chapter_reports WHERE id=?').bind(first.data.id).first();
      const snapshot=JSON.parse(edition.payload);assert.equal(snapshot.revisionOf,entry.id);assert.equal(snapshot.revisionReason,input.reason);assert.ok(!edition.payload.includes('privateNote'));
      assert.ok(snapshot.reports.every(r=>Array.isArray(r.activities)&&Array.isArray(r.skills)));
      assert.deepEqual(await db.prepare('SELECT * FROM chapter_reports WHERE id=?').bind(entry.id).first(),original);
      const exported=await call(first.data.url.replace('/api/',''),'GET',null,parentCookie);assert.equal(exported.status,200);
      assert.equal((await call('chapters/suites/summary?closure='+entry.id+'&layout=latest&edition=inconnue','GET',null,parentCookie)).status,404);
      assert.deepEqual(await db.prepare('SELECT * FROM chapter_reports WHERE id=?').bind(entry.id).first(),original);
    });
    await t.test("note et durée du contrôle dans la même rubrique, sans obligation de durée", async () => {
      const target=(await call('data')).data.reports[0];const editor=(await call('sessions/'+target.session_id)).data;
      const saved=await call('sessions/'+target.session_id+'/draft','PUT',{report:{...editor.draft,assessmentTitle:'TEST Contrôle chronométré',score:12,scale:20,assessmentMinutes:42},version:editor.session.version});assert.equal(saved.status,200);
      assert.equal((await call('sessions/'+target.session_id+'/update','POST',{version:saved.data.version,requestKey:'control-duration'})).status,200);
      const updated=(await call('data')).data;const report=updated.reports.find(r=>r.session_id===target.session_id);assert.equal(report.payload.assessmentMinutes,42);
      const points=updated.chapters.find(c=>c.id===report.payload.chapterId).metrics.assessments;assert.ok(points.some(p=>p.minutes===42 && p.score===12));
      const pdf=await call('reports/'+target.session_id+'/pdf');const pdfContent=await pdfText(new Uint8Array(await pdf.response.arrayBuffer()));assert.ok(pdfContent.includes('42 min'));const pubDate=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());assert.ok(pdfContent.includes('Publié le '+pubDate));
      const fresh=(await call('sessions/'+target.session_id)).data;
      const bad=await call('sessions/'+target.session_id+'/draft','PUT',{report:{...fresh.draft,assessmentMinutes:0},version:fresh.session.version});assert.equal(bad.status,400);
    });
    await t.test("ajout de chapitre : droits, référentiel automatique, unicité et absence de données inventées",async()=>{
      const before=(await call('data')).data;
      assert.equal(before.catalogue.length,14);
      assert.equal((await call('context','GET',null,parentCookie)).data.canReturnToTeacher,false);
      const ownerPreview=await call('context','GET',null,parentCookie,{'oai-authenticated-user-id':'test-teacher'});
      assert.equal(ownerPreview.data.role,'parent');assert.equal(ownerPreview.data.canReturnToTeacher,true);

      assert.equal((await call('data','GET',null,parentCookie)).data.catalogue.length,0);
      const input={templateId:'derivation',title:'TEST Dérivation',start:true,validated:true};
      assert.equal((await call('chapters','POST',input,parentCookie)).status,403);
      assert.equal((await call('chapters','POST',input,null)).status,401);
      assert.equal((await call('chapters','POST',{...input,templateId:'inconnu'})).status,400);
      const created=await call('chapters','POST',input);assert.equal(created.status,201);
      const data=(await call('data')).data, chapter=data.chapters.find(c=>c.id===created.data.id);
      assert.equal(chapter.state,'active');assert.equal(chapter.grid.validated,1);assert.ok(chapter.grid.skills.length>=12);
      assert.equal(chapter.grid.source.page,7);assert.ok(chapter.grid.source.excerpt.includes('Taux de variation'));
      assert.equal(chapter.metrics.mastery,null);assert.equal(chapter.metrics.progression,null);assert.equal(chapter.metrics.sessions,0);assert.equal(chapter.metrics.tds,0);
      assert.equal(data.historyReports.length,before.historyReports.length);
      assert.equal((await call('chapters','POST',input)).status,409);
      assert.equal((await call('data')).data.chapters.length,before.chapters.length+1);
      assert.equal(data.sessions.length,before.sessions.length);
      const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(new Date());
      const made=await call('sessions','POST',{date,chapterId:chapter.id});
      const editor=(await call('sessions/'+made.data.id)).data;
      const report={...editor.draft,title:'TEST Un bilan avec support',documentIds:[pdfId],activities:[{id:'a',skillId:chapter.grid.skills[0].id,type:'td',level:25,confirmed:false,workRef:'TD dérivation 1',exercises:''}]};
      const saved=await call('sessions/'+made.data.id+'/draft','PUT',{report,version:editor.session.version});
      const published=await call('sessions/'+made.data.id+'/publish','POST',{version:saved.data.version,requestKey:'new-chapter-support'});assert.equal(published.status,200);
      for(let i=0;i<2;i++)assert.equal((await call('documents/'+pdfId,'GET',null,parentCookie)).status,200);
      const summary=(await call('data')).data.chapters.find(c=>c.id===chapter.id).metrics;
      assert.equal(summary.sessions,1);assert.equal(summary.tds,1);assert.equal(summary.evaluations,0);
    });
    await t.test("chargement groupé : mêmes bilans, statistiques historiques et protection parent", async () => {
      for (const date of ["2025-12-31", "2026-11-07"]) {
        const grouped = await call("workspace", "POST", {date}, parentCookie);
        assert.equal(grouped.status, 200);
        assert.equal(grouped.data.context.role, "parent");
        assert.deepEqual(grouped.data.data, (await call("data?date="+date, "GET", null, parentCookie)).data);
        assert.ok(!JSON.stringify(grouped.data).includes('privateNote'));
      }
      assert.equal((await call("workspace", "POST", {date:"invalide"})).status, 400);
      assert.equal((await call("workspace", "POST", {date:"2026-11-07"}, null)).status, 401);
      assert.equal((await call("workspace", "POST", {date:"2026-11-07"}, "teacher", {Origin:"https://autre.test"})).status, 403);
    });
    await t.test("ajout idempotent, corbeille des séances prévues et des brouillons, restauration intacte", async () => {
      const date=today(), input={date, chapterId:"suites", requestKey:"test-add-session-unique"};
      const first=await call("sessions", "POST", input);
      assert.equal(first.status, 200);
      const id=first.data.id;
      assert.equal((await call("sessions", "POST", input)).data.id,id);
      assert.equal((await call("sessions", "POST", {...input,date:"2026-01-01"})).status,409);
      assert.equal((await call("sessions/"+id,"DELETE",null,parentCookie)).status,403);
      assert.equal((await call("sessions/"+id+"/restore","POST",{},parentCookie)).status,403);
      const editor=(await call("sessions/"+id)).data;
      const draft={...editor.draft,title:"TEST — brouillon à conserver",privateNote:"TEST — note privée conservée"};
      const saved=await call("sessions/"+id+"/draft","PUT",{report:draft,version:editor.session.version});
      assert.equal(saved.status,200);
      const savedDraft=(await call("sessions/"+id)).data.draft;
      assert.equal((await call("sessions/"+id,"DELETE")).status,200);
      assert.equal((await call("sessions/"+id,"DELETE")).status,200);
      assert.equal((await call("sessions/"+id)).status,410);
      assert.ok(!(await call("data")).data.historySessions.some(s=>s.id===id));
      assert.equal((await call("trash")).data.sessions.find(s=>s.id===id).title,draft.title);
      assert.equal((await call("sessions", "POST", input)).status,409);
      assert.equal((await call("sessions/"+id+"/restore","POST",{})).status,200);
      const restored=(await call("sessions/"+id)).data;
      assert.deepEqual(restored.draft,savedDraft);
      assert.ok(restored.session.version>saved.data.version);
      assert.equal((await call("sessions/"+id+"/draft","PUT",{report:draft,version:saved.data.version})).status,409);
      assert.equal((await call("sessions/absente","DELETE")).status,404);
    });
    await t.test("une séance habituelle supprimée ne revient pas à la préparation, et peut être restaurée", async () => {
      const date=today();
      await call("prepare","POST",{date});
      const regular=await db.prepare("SELECT id FROM sessions WHERE origin_key=?").bind("regular-"+dateOfNextRegular(date)).first();
      assert.ok(regular);
      await call("sessions/"+regular.id,"DELETE");
      await call("workspace","POST",{date});
      assert.ok(!(await call("data")).data.sessions.some(s=>s.id===regular.id));
      assert.ok((await call("trash")).data.sessions.some(s=>s.id===regular.id));
      await call("sessions/"+regular.id+"/restore","POST",{});
      assert.ok((await call("data")).data.sessions.some(s=>s.id===regular.id));
    });
    await t.test("suppression d’une séance publiée : PDF et statistiques retirés puis restaurés sans doublon", async () => {
      const before=(await call("data")).data, published=before.historyReports[0], id=published.session_id;
      await call("sessions/"+id,"DELETE");
      assert.ok(!(await call("data")).data.historyReports.some(r=>r.session_id===id));
      assert.ok([404,410].includes((await call("reports/"+id+"/pdf","GET",null,parentCookie)).status));
      assert.ok((await call("trash")).data.sessions.some(s=>s.id===id));
      await call("sessions/"+id+"/restore","POST",{});
      const after=(await call("data")).data;
      assert.deepEqual(after.chapters.map(c=>c.metrics),before.chapters.map(c=>c.metrics));
      assert.equal(after.historyReports.filter(r=>r.session_id===id).length,1);
      assert.equal((await call("reports/"+id+"/pdf","GET",null,parentCookie)).status,200);
    });
    await t.test("ajout rapide validé : grille versionnée, référentiel intact, droits et reprise après réponse perdue", async()=>{
      const before=(await call("data")).data, chapter=before.chapters.find(c=>c.id==='suites'), oldReports=before.historyReports;
      const input={baseGridId:chapter.grid.id,skillId:'test-extra-algebra',label:'Réduire une expression littérale',group:'Fondamentaux du calcul algébrique',validated:true};
      assert.equal((await call('chapters/suites/skills','POST',input,parentCookie)).status,403);
      assert.equal((await call('chapters/suites/skills','POST',{...input,validated:false})).status,400);
      const added=await call('chapters/suites/skills','POST',input);assert.equal(added.status,200);
      assert.equal(added.data.skill.origin,'teacher');assert.equal(added.data.skill.validated,true);
      assert.deepEqual(added.data.grid.source,chapter.grid.source);
      assert.equal(added.data.grid.skills.length,chapter.grid.skills.length+1);
      assert.equal((await call('chapters/suites/skills','POST',input)).data.grid.id,added.data.grid.id);
      assert.equal((await call('chapters/suites/skills','POST',{...input,skillId:'test-other-skill',label:'Autre compétence'})).status,409);
      const after=(await call('data')).data;
      assert.equal(after.chapters.find(c=>c.id==='suites').grid.id,added.data.grid.id);
      const historical=(await call('data?date=2025-01-01')).data.chapters.find(c=>c.id==='suites');
      assert.equal(historical.currentGrid.id,added.data.grid.id);
      assert.notEqual(historical.grid.id,added.data.grid.id);
      assert.equal((await call('data?date=2025-01-01','GET',null,parentCookie)).data.chapters.find(c=>c.id==='suites').currentGrid,undefined);

      assert.deepEqual(after.historyReports,oldReports);
    });
    await t.test("TD multi-compétences : un support, un TD, observations individuelles et publication protégée",async()=>{
      let data=(await call('data')).data, chapter=data.chapters.find(c=>c.id==='suites');
      if(!chapter.grid.validated){await call('chapters/suites/grid','POST',{baseGridId:chapter.grid.id,skills:chapter.grid.skills,validated:true});data=(await call('data')).data;chapter=data.chapters.find(c=>c.id==='suites');}
      const made=await call('sessions','POST',{date:today(),chapterId:chapter.id}), id=made.data.id, editor=(await call('sessions/'+id)).data;
      const workId='test-shared-td', activities=chapter.grid.skills.slice(0,3).map((skill,i)=>({id:'test-mini-'+i,workId,skillId:skill.id,type:'td',level:null,confirmed:false,workRef:'',exercises:'',documentIds:[pdfId]}));
      const report={...editor.draft,title:'TEST — un seul TD, trois notions',activities,documentIds:[pdfId]};
      assert.equal((await call('sessions/'+id+'/draft','PUT',{version:editor.session.version,report:{...report,documentIds:[]}})).status,400);
      assert.equal((await call('sessions/'+id+'/draft','PUT',{version:editor.session.version,report:{...report,activities:[...activities,{...activities[0],id:'duplicate'}]}})).status,400);
      assert.equal((await call('sessions/'+id+'/draft','PUT',{version:editor.session.version,report:{...report,activities:activities.map((a,i)=>i===1?{...a,type:'cours'}:a)}})).status,400);
      const saved=await call('sessions/'+id+'/draft','PUT',{version:editor.session.version,report});assert.equal(saved.status,200);
      const before=(await call('data')).data.chapters.find(c=>c.id===chapter.id).metrics;
      assert.equal((await call('sessions/'+id+'/publish','POST',{version:saved.data.version,requestKey:'multi-notions-one-td'})).status,200);
      const after=(await call('data')).data, summary=after.chapters.find(c=>c.id===chapter.id).metrics;
      assert.equal(summary.tds,before.tds+1);assert.equal(summary.sessions,before.sessions+1);assert.equal(summary.evaluated,before.evaluated);
      assert.equal(after.historyReports.find(r=>r.session_id===id).payload.activities.length,3);
      const pdf=await call('reports/'+id+'/pdf','GET',null,parentCookie);assert.equal(pdf.status,200);
      assert.match(await pdfText(new Uint8Array(await pdf.response.arrayBuffer())),/TEST/);
    });
    await t.test("100 % se publie sans confirmation d’autonomie, avec un libellé factuel",async()=>{
      const chapter=(await call('data')).data.chapters.find(c=>c.id==='suites');
      const made=await call('sessions','POST',{date:today(),chapterId:chapter.id}),id=made.data.id,editor=(await call('sessions/'+id)).data;
      const report={...editor.draft,title:'TEST — réussite observée à 100 %',activities:[{id:'observed-100',skillId:chapter.grid.skills[0].id,type:'td',level:100,confirmed:false,workRef:'TD test réussite observée',exercises:''}]};
      const saved=await call('sessions/'+id+'/draft','PUT',{report,version:editor.session.version});assert.equal(saved.status,200);
      const input={version:saved.data.version,requestKey:'publish-observed-100'};
      const published=await call('sessions/'+id+'/publish','POST',input);assert.equal(published.status,200,JSON.stringify(published.data));
      assert.equal((await call('sessions/'+id+'/publish','POST',input)).status,200);
      const pdf=await call('reports/'+id+'/pdf','GET',null,parentCookie);assert.equal(pdf.status,200);
      const content=await pdfText(new Uint8Array(await pdf.response.arrayBuffer()));
      assert.match(content,/Réussite observée sur les exercices travaillés/);assert.ok(!content.includes('Réussite autonome confirmée'));
      const revision=(await call('sessions/'+id)).data.revisions[0];assert.equal(revision.payload.activities[0].level,100);assert.equal(revision.payload.activities[0].confirmed,false);
    });
    await t.test("une séance ancienne publiée plus tard reste visible, sans modifier les indicateurs historiques",async()=>{
      const chapter=(await call('data')).data.chapters.find(c=>c.id==='suites');
      const made=await call('sessions','POST',{date:'2026-10-03',chapterId:chapter.id}),id=made.data.id,editor=(await call('sessions/'+id)).data;
      const report={...editor.draft,title:'TEST — bilan publié après sa semaine',documentIds:[pdfId],activities:[{id:'late-observation',skillId:chapter.grid.skills[0].id,type:'td',level:25,confirmed:false,workRef:'TEST TD historique',exercises:''}]};
      let saved=await call('sessions/'+id+'/draft','PUT',{report,version:editor.session.version});
      assert.equal((await call('sessions/'+id+'/publish','POST',{version:saved.data.version,requestKey:'late-week-publication'})).status,200);
      for(const viewer of ['teacher',parentCookie]){
        const data=(await call('data?date=2026-10-03','GET',null,viewer)).data;
        const card=data.sessions.find(s=>s.id===id);assert.ok(card);assert.equal(card.status,'published');assert.equal(card.revision,1);assert.ok(card.pdf.url);
        assert.equal(data.sessions.filter(s=>s.id===id).length,1);assert.equal(card.report.activities[0].level,25);
        assert.ok(!data.reports.some(r=>r.session_id===id));assert.equal(data.chapters.find(c=>c.id===chapter.id).metrics.mastery,null);
      }
      const current=(await call('sessions/'+id)).data;
      saved=await call('sessions/'+id+'/draft','PUT',{report:{...current.draft,activities:current.draft.activities.map(a=>({...a,level:75}))},version:current.session.version});
      assert.equal((await call('sessions/'+id+'/update','POST',{version:saved.data.version,requestKey:'late-week-correction',reason:'TEST — correction historique'})).status,200);
      const corrected=(await call('data?date=2026-10-03','GET',null,parentCookie)).data;
      assert.equal(corrected.sessions.find(s=>s.id===id).revision,2);assert.equal(corrected.sessions.find(s=>s.id===id).report.activities[0].level,75);
      assert.equal(corrected.chapters.find(c=>c.id===chapter.id).metrics.mastery,null);
      const inline=await call('reports/'+id+'/pdf?view=1','GET',null,parentCookie);assert.equal(inline.status,200);assert.match(inline.response.headers.get('content-disposition'),/^inline;/);assert.match(inline.response.headers.get('cache-control'),/private, no-store/);
      assert.equal((await call('reports/'+id+'/pdf?view=1','GET',null,null)).status,401);
    });
    await t.test("synthèse et estimations : brouillon privé, publication factuelle et correction conservée",async()=>{
      const chapter=(await call('data')).data.chapters.find(c=>c.id==='suites');
      const made=await call('sessions','POST',{date:today(),chapterId:chapter.id}),id=made.data.id,editor=(await call('sessions/'+id)).data;
      const summary={objective:'TEST objectif clair',strengths:'TEST réussite visible',focus:'TEST signes à reprendre',nextStep:'TEST vérifier les racines'};
      const report={...editor.draft,title:'TEST bilan synthétique',summary,privateNote:'TEST SECRET PROF',activities:[{id:'estimated',skillId:chapter.grid.skills[0].id,type:'td',level:75,estimated:true,evidence:'TEST correction visible sans note globale',confirmed:false,workRef:'TD synthèse',exercises:''}]};
      assert.equal((await call('sessions/'+id+'/draft','PUT',{report:{...report,summary:[]},version:editor.session.version})).status,400);
      const saved=await call('sessions/'+id+'/draft','PUT',{report,version:editor.session.version});assert.equal(saved.status,200);
      const loaded=(await call('sessions/'+id)).data;assert.deepEqual(loaded.draft.summary,summary);assert.equal(loaded.draft.activities[0].estimated,true);
      assert.ok(!(await call('data','GET',null,parentCookie)).data.historyReports.some(r=>r.session_id===id));
      assert.equal((await call('sessions/'+id+'/publish','POST',{version:saved.data.version,requestKey:'publish-synthesis'})).status,200);
      const parent=(await call('data','GET',null,parentCookie)).data.historyReports.find(r=>r.session_id===id);assert.deepEqual(parent.payload.summary,summary);assert.equal(parent.payload.privateNote,undefined);
      const pdf=await call('reports/'+id+'/pdf','GET',null,parentCookie);const bytes=new Uint8Array(await pdf.response.arrayBuffer());const text=await pdfText(bytes);
      for(const value of Object.values(summary))assert.ok(text.includes(value));assert.ok(text.includes('estimation pédagogique'));assert.ok(text.includes(report.activities[0].evidence));assert.ok(!text.includes('TEST SECRET PROF'));assert.ok(!text.includes('Durée : 2 h'));assert.ok(!text.includes('autonome confirmée'));
      const edit=(await call('sessions/'+id)).data;const save=await call('sessions/'+id+'/draft','PUT',{report:{...edit.draft,summary:{...summary,focus:'TEST nouvelle précision'}},version:edit.session.version});
      assert.equal((await call('sessions/'+id+'/update','POST',{version:save.data.version,requestKey:'correct-synthesis',reason:'TEST précision'})).status,200);
      const historical=await call('reports/'+id+'/pdf?revision=1','GET',null,parentCookie);assert.deepEqual(new Uint8Array(await historical.response.arrayBuffer()),bytes);
      const versions=(await call('sessions/'+id)).data.revisions;assert.equal(versions.length,2);assert.equal(versions[0].payload.summary.focus,summary.focus);assert.equal(versions[1].payload.summary.focus,'TEST nouvelle précision');
    });
    await t.test("planning automatique en consultation : semaines ISO, déplacement et suppression sans doublons",async()=>{
      const date=(new Date().getUTCFullYear()+1)+'-12-31';
      const before=(await call('data')).data.chapters.map(c=>[c.id,c.metrics.sessions,c.metrics.tds,c.metrics.evaluations]);
      const first=await call('workspace','POST',{date},parentCookie);assert.equal(first.status,200);
      const slots=first.data.data.sessions;assert.equal(slots.length,3);
      assert.deepEqual(slots.map(s=>new Date(s.date+'T12:00:00Z').getUTCDay()),[3,6,0]);
      assert.ok(slots.every(s=>s.status==='planned' && !s.hasDraft && !s.report && !s.preview));
      const again=await call('workspace','POST',{date},parentCookie);assert.deepEqual(again.data.data.sessions.map(s=>s.id),slots.map(s=>s.id));
      assert.equal((await call('prepare','POST',{date},parentCookie)).status,403);
      const wed=slots[0],editor=(await call('sessions/'+wed.id)).data,next=new Date(wed.date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
      assert.equal((await call('sessions/'+wed.id+'/schedule','POST',{date:next.toISOString().slice(0,10),status:'planned',version:editor.session.version})).status,200);
      const moved=(await call('workspace','POST',{date},parentCookie)).data.data.sessions;
      assert.equal(moved.length,3);assert.ok(!moved.some(s=>s.date===wed.date));assert.equal(moved.find(s=>s.id===wed.id).date,next.toISOString().slice(0,10));
      assert.equal((await call('sessions/'+slots[1].id,'DELETE')).status,200);
      assert.equal((await call('workspace','POST',{date},parentCookie)).data.data.sessions.length,2);
      assert.equal((await call('sessions/'+slots[1].id+'/restore','POST',{})).status,200);
      assert.equal((await call('workspace','POST',{date},parentCookie)).data.data.sessions.length,3);
      const after=(await call('data')).data.chapters.map(c=>[c.id,c.metrics.sessions,c.metrics.tds,c.metrics.evaluations]);assert.deepEqual(after,before);
      const future=new Date(today()+'T12:00:00Z');future.setUTCDate(future.getUTCDate()+56);
      assert.equal((await call('data?date='+future.toISOString().slice(0,10),'GET',null,parentCookie)).data.sessions.length,3);
    });
  } finally {
    await mf.dispose();
  }
});
