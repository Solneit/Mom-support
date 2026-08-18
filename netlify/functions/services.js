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
        name: f["Nome do serviço"] || "",
        institution: f["Instituição"] || "",
        type: f["Tipo de serviço"] || "",
        ageMin: f["Age Min"] ?? null,
        ageMax: f["Age Max"] ?? null,
        ageRangeLabel: f["Faixa etária"] || "",
        vacancyStatus: f["Estado das vagas"] || "Unknown",
        waitingList: f["Lista de espera"] || "Unknown",
        applicationsOpen: f["Candidaturas abertas"] || "Unknown",
        schedule: f["Horário"] || "",
        priceMonth: f["Preço / mês"] ?? null,
        lastVerified: f["Última verificação do serviço"] || "",
        verificationMethod: f["Método de verificação"] || "",
        phone: f["Telefone da instituição"] || "",
        email: f["Email da instituição"] || "",
        website: f["Website da instituição"] || "",
        facebook: f["Facebook da instituição"] || "",
        instagram: f["Instagram da instituição"] || "",
        address: f["Morada da instituição"] || "",
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
