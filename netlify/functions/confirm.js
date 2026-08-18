// netlify/functions/confirm.js
//
// Powers Screen 6: a no-login link a creche opens to confirm/update its own
// vacancy status. GET returns that institution's services; POST writes a
// status update back to Airtable.
//
// SECURITY NOTE: this endpoint writes data using a token that must be
// PUBLIC-facing (the link has no login), so the token given to this function
// should be scoped as narrowly as possible:
//   - data.records:read + data.records:write
//   - Access limited to ONLY the SERVICES table, not the whole base
// Create a second, separate Personal Access Token for this reason and set it
// as AIRTABLE_TOKEN_WRITE (kept apart from the read-only AIRTABLE_TOKEN used
// by services.js / plan.js).

const BASE_ID = "appenkUjX71btkhcc";
const TABLE_NAME = "SERVICES";

// Airtable Link/Lookup fields return arrays even for a single value.
function flatten(val) {
  if (Array.isArray(val)) return val.length ? String(val[0]) : "";
  if (val === null || val === undefined) return "";
  return String(val);
}

// "Instituição" is a Link field — the API returns the linked record's ID,
// not its display name. "Nome do serviço" reliably follows
// "InstitutionName_Type", so derive the real name from that instead.
function institutionName(f) {
  const raw = flatten(f["Instituição"]);
  const looksLikeRecordId = /^rec[A-Za-z0-9]{14,}$/.test(raw);
  if (raw && !looksLikeRecordId) return raw;
  const svcName = flatten(f["Nome do serviço"]);
  if (svcName.includes("_")) return svcName.split("_")[0].trim();
  return raw || svcName;
}

async function airtableFetch(path, token, options = {}) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${path}`;
  const resp = await airtableCall(url, token, options);
  return resp;
}

async function airtableCall(url, token, options) {
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await resp.json();
  if (!resp.ok) throw Object.assign(new Error(data.error?.message || "Airtable error"), { status: resp.status });
  return data;
}

exports.handler = async (event) => {
  const readToken = process.env.AIRTABLE_TOKEN;
  const writeToken = process.env.AIRTABLE_TOKEN_WRITE || process.env.AIRTABLE_TOKEN;
  if (!readToken) {
    return { statusCode: 500, body: JSON.stringify({ error: "AIRTABLE_TOKEN not set" }) };
  }

  if (event.httpMethod === "GET") {
    const institution = (event.queryStringParameters || {}).institution;
    if (!institution) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing ?institution=" }) };
    }
    try {
      const data = await airtableFetch(encodeURIComponent(TABLE_NAME), readToken);
      const services = (data.records || [])
        .filter((r) => institutionName(r.fields) === institution)
        .map((r) => ({
          id: r.id,
          service: flatten(r.fields["Nome do serviço"]),
          type: flatten(r.fields["Tipo de serviço"]),
          ageRangeLabel: flatten(r.fields["Faixa etária"]),
          vacancyStatus: flatten(r.fields["Estado das vagas"]) || "Unknown",
          lastVerified: flatten(r.fields["Última verificação do serviço"]),
        }));
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ institution, services }),
      };
    } catch (err) {
      return { statusCode: err.status || 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      const { recordId, vacancyStatus } = body;
      if (!recordId || !vacancyStatus) {
        return { statusCode: 400, body: JSON.stringify({ error: "recordId and vacancyStatus required" }) };
      }
      const today = new Date().toISOString().slice(0, 10);
      const data = await airtableFetch(`${encodeURIComponent(TABLE_NAME)}/${recordId}`, writeToken, {
        method: "PATCH",
        body: JSON.stringify({
          fields: {
            "Estado das vagas": vacancyStatus,
            "Última verificação do serviço": today,
            "Método de verificação": "Institution self-confirm",
          },
        }),
      });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, record: data }),
      };
    } catch (err) {
      return { statusCode: err.status || 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};
