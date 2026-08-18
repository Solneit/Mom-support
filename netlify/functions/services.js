// netlify/functions/services.js
//
// Server-side proxy to Airtable. The Airtable token NEVER reaches the browser —
// it lives only in the Netlify environment variable AIRTABLE_TOKEN, set in
// Netlify dashboard -> Site settings -> Environment variables.
//
// Query params supported (all optional, all applied client-side after fetch
// since the test base is tiny — swap to Airtable filterByFormula once the
// base grows past a couple hundred rows):
//   ageMonths   -> integer, keeps rows where Age Min <= ageMonths <= Age Max
//   municipality-> string, matches "Morada da instituição" loosely
//   type        -> "Creche" | "CATL" | "Pre-school / Jardim de Infância"

const BASE_ID = "appenkUjX71btkhcc";
const TABLE_NAME = "SERVICES"; // exact table name as created in Airtable

// Airtable Link and Lookup fields come back as arrays even when there's only
// one value (e.g. "Instituição" -> ["O Saltitão"], "Morada da instituição"
// -> ["Rua Serpa Pinto 102"]). This normalizes any field to a plain string
// regardless of whether Airtable sent a string, an array, or nothing.
function flatten(val) {
  if (Array.isArray(val)) return val.length ? String(val[0]) : "";
  if (val === null || val === undefined) return "";
  return String(val);
}

exports.handler = async (event) => {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AIRTABLE_TOKEN is not set in the Netlify environment." }),
    };
  }

  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { statusCode: resp.status, body: JSON.stringify({ error: text }) };
    }

    const data = await resp.json();
    const params = event.queryStringParameters || {};

    let records = (data.records || []).map((r) => {
      const f = r.fields || {};
      return {
        id: r.id,
        name: flatten(f["Nome do serviço"]),
        institution: flatten(f["Instituição"]),
        type: flatten(f["Tipo de serviço"]),
        ageMin: f["Age Min"] ?? null,
        ageMax: f["Age Max"] ?? null,
        ageRangeLabel: flatten(f["Faixa etária"]),
        vacancyStatus: flatten(f["Estado das vagas"]) || "Unknown",
        waitingList: flatten(f["Lista de espera"]) || "Unknown",
        applicationsOpen: flatten(f["Candidaturas abertas"]) || "Unknown",
        schedule: flatten(f["Horário"]),
        priceMonth: f["Preço / mês"] ?? null,
        lastVerified: flatten(f["Última verificação do serviço"]),
        verificationMethod: flatten(f["Método de verificação"]),
        phone: flatten(f["Telefone da instituição"]),
        email: flatten(f["Email da instituição"]),
        website: flatten(f["Website da instituição"]),
        facebook: flatten(f["Facebook da instituição"]),
        instagram: flatten(f["Instagram da instituição"]),
        address: flatten(f["Morada da instituição"]),
      };
    });

    if (params.ageMonths) {
      const age = parseInt(params.ageMonths, 10);
      records = records.filter((s) => {
        const min = s.ageMin ?? -Infinity;
        const max = s.ageMax ?? Infinity;
        return age >= min && age <= max;
      });
    }
    if (params.municipality) {
      const q = params.municipality.trim().toLowerCase();
      records = records.filter((s) => (s.address || "").toLowerCase().includes(q));
    }
    if (params.type) {
      records = records.filter((s) => s.type === params.type);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ count: records.length, results: records }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
