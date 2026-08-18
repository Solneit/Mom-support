// netlify/functions/plan.js
//
// Returns one parent's "O meu plano" data: countdown, progress counts,
// next action, and the list of applications with status.
//
// Query param: parentName (defaults to "Test Parent" while the base only
// has test data). Real version should switch to parentId once auth exists.

const BASE_ID = "appenkUjX71btkhcc";
const PARENTS_TABLE = "PARENTS";
const APPLICATIONS_TABLE = "APPLICATIONS";

async function fetchTable(table, token) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`${table}: HTTP ${resp.status} — ${await resp.text()}`);
  return resp.json();
}

// Airtable linked-record fields sometimes come back as an array of record
// IDs, sometimes (with a lookup) as an array of display strings. Normalize
// to a single readable string either way.
function flatten(val) {
  if (Array.isArray(val)) return val.join(", ");
  return val || "";
}

exports.handler = async (event) => {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: "AIRTABLE_TOKEN not set" }) };
  }

  const parentName = (event.queryStringParameters || {}).parentName || "Test Parent";

  try {
    const [parentsData, appsData] = await Promise.all([
      fetchTable(PARENTS_TABLE, token),
      fetchTable(APPLICATIONS_TABLE, token),
    ]);

    const parentRecord = (parentsData.records || []).find(
      (r) => flatten(r.fields["Parent Name"]) === parentName
    );

    if (!parentRecord) {
      return { statusCode: 404, body: JSON.stringify({ error: `Parent "${parentName}" not found` }) };
    }

    const pf = parentRecord.fields;

    const apps = (appsData.records || [])
      .filter((r) => flatten(r.fields["Parent"]) === parentName)
      .map((r) => {
        const f = r.fields;
        return {
          id: r.id,
          service: flatten(f["Service"]) || "Serviço a confirmar",
          status: f["Status"] || "No Response",
          nextFollowUp: f["Next Follow-Up"] || "",
          waitingListPosition: f["Waiting List Position"] ?? null,
          visitDate: f["Visit Date"] || "",
          nextAction: f["Next Action"] || "",
          notes: f["Notes"] || "",
        };
      });

    // Progress counts
    const totalApplications = apps.length;
    const waitingLists = apps.filter((a) => /waiting|espera/i.test(a.status)).length;
    const visits = apps.filter((a) => a.visitDate || /visit/i.test(a.status)).length;
    const accepted = apps.filter((a) => /accept|confirm/i.test(a.status)).length;

    // Next action: earliest Next Follow-Up date with a Next Action; else first app with a Next Action
    const withFollowUp = apps
      .filter((a) => a.nextFollowUp)
      .sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp));
    const nextActionSource = withFollowUp[0] || apps.find((a) => a.nextAction) || null;

    // Countdown to "Childcare Needed From"
    const neededFrom = pf["Childcare Needed From"];
    let daysRemaining = null;
    if (neededFrom) {
      const diffMs = new Date(neededFrom) - new Date();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        parent: {
          name: pf["Parent Name"],
          childcareNeededFrom: neededFrom || null,
          daysRemaining,
          childcareConfirmed: pf["Childcare Confirmed"] || "NO",
        },
        progress: {
          totalApplications,
          waitingLists,
          visits,
          accepted,
        },
        nextAction: nextActionSource
          ? {
              when: nextActionSource.nextFollowUp || "Em breve",
              service: nextActionSource.service,
              action: nextActionSource.nextAction || "Fazer follow-up",
            }
          : null,
        applications: apps,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
