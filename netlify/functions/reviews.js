// netlify/functions/reviews.js
//
// Powers the ratings strip on Instituição (GET) and the "Partilhar
// atualização" form (POST) — both backed by the AVALIAÇÕES table.
//
// GET  ?service=<Nome do serviço>   -> averages + count for that service
// POST { serviceId, serviceName, vacancyStatusReported, contactDate,
//        contactMethod, gotSpot, comment }
//   -> creates a new AVALIAÇÕES record. Written with "Estado da moderação":
//      "Pendente" — this endpoint is public and unauthenticated, so new
//      submissions should be reviewed before they affect anything else
//      (e.g. before feeding into Resultados' vacancy status).

const BASE_ID = "appenkUjX71btkhcc";
const AVALIACOES_TABLE = "AVALIAÇÕES";

async function airtableCall(path, token, options = {}) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${path}`;
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

function flatten(val) {
  if (Array.isArray(val)) return val.join(", ");
  return val || "";
}

function avg(nums) {
  const clean = nums.filter((n) => typeof n === "number");
  if (!clean.length) return null;
  return Math.round((clean.reduce((a, b) => a + b, 0) / clean.length) * 10) / 10;
}

exports.handler = async (event) => {
  const readToken = process.env.AIRTABLE_TOKEN;
  const writeToken = process.env.AIRTABLE_TOKEN_WRITE || process.env.AIRTABLE_TOKEN;
  if (!readToken) return { statusCode: 500, body: JSON.stringify({ error: "AIRTABLE_TOKEN not set" }) };

  if (event.httpMethod === "GET") {
    const serviceName = (event.queryStringParameters || {}).service;
    try {
      const data = await airtableCall(encodeURIComponent(AVALIACOES_TABLE), readToken);
      let records = data.records || [];
      if (serviceName) {
        records = records.filter((r) => flatten(r.fields["Serviço"]) === serviceName);
      }
      // Only count moderated (non-rejected) reviews in the public average.
      const approved = records.filter((r) => (r.fields["Estado da moderação"] || "") !== "Rejeitada");

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          count: approved.length,
          geral: avg(approved.map((r) => r.fields["Avaliação geral"])),
          comunicacao: avg(approved.map((r) => r.fields["Comunicação"])),
          processo: avg(approved.map((r) => r.fields["Processo de candidatura"])),
        }),
      };
    } catch (err) {
      return { statusCode: err.status || 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      const { serviceId, vacancyStatusReported, contactDate, contactMethod, gotSpot, comment } = body;
      if (!serviceId || !vacancyStatusReported || !contactDate) {
        return { statusCode: 400, body: JSON.stringify({ error: "serviceId, vacancyStatusReported, contactDate are required" }) };
      }
      const today = new Date().toISOString().slice(0, 10);
      const data = await airtableCall(encodeURIComponent(AVALIACOES_TABLE), writeToken, {
        method: "POST",
        body: JSON.stringify({
          fields: {
            "Serviço": [serviceId],
            "Estado das vagas comunicado": vacancyStatusReported,
            "Data do contacto": contactDate,
            "Método de contacto": contactMethod || "Website",
            "Conseguiu vaga?": gotSpot || "Ainda não sei",
            "Comentário": comment || "",
            "Data da avaliação": today,
            "Estado da moderação": "Pendente",
          },
        }),
      });
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, record: data }) };
    } catch (err) {
      return { statusCode: err.status || 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};
