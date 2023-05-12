const readline = require('readline/promises');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const BATCH_SIZE = 100;
const COUCH_URL = process.env.COUCH_URL;
const COUCH_URL_PATTERN = /^(https?:\/\/)(.+):(.+)@(.+)\/medic$/g;
const [,
  PROTOCOL,
  ADMIN_USER,
  ADMIN_PASS,
  HOST
] = COUCH_URL_PATTERN.exec(COUCH_URL);

const MEDIC_DB_URL = `${PROTOCOL}${HOST}/medic`;
const REPORTS_BY_DATE_URL = `${MEDIC_DB_URL}/_design/medic-client/_view/reports_by_date`;
const PURGE_URL = `${MEDIC_DB_URL}/_purge`;
const AUTH_HEADER = `Basic ${Buffer.from(ADMIN_USER + ':' + ADMIN_PASS, "binary").toString("base64")}`;
const FETCH_HEADERS = {
  "Content-Type": "application/json",
  'Authorization': AUTH_HEADER
};

const fetchOnDb = async (method, url, data) => {
  const response = await fetch(url, {
    method,
    headers: FETCH_HEADERS,
    body: data ? JSON.stringify(data): null,
  });
  return response.json();
};

const getReportsByDateURL = endDateMillis => `${REPORTS_BY_DATE_URL}?include_docs=false&endkey=[${endDateMillis}]`;
const getDocIds = async (endDateMillis) => {
  const response = await fetchOnDb('GET', getReportsByDateURL(endDateMillis));
  return response.rows.map(row => row.id);
};

const createBulkGetBody = ids => ({ docs: ids.map(id => ({ id })) });
const hasOkDoc = ({ docs }) => docs && docs.length && docs[0].ok;
const getOkDoc = ({ docs: [{ ok }] }) => ok;
const populateRevsById = (revsById, { _id, _rev }) => {
  revsById[_id] = [_rev];
  return revsById;
};
const getDocRevsById = async (ids) => {
  const response = await fetchOnDb('POST', `${MEDIC_DB_URL}/_bulk_get`, createBulkGetBody(ids));
  return response.results
                 .filter(hasOkDoc)
                 .map(getOkDoc)
                 .reduce(populateRevsById, {});
};

const getBatches = (array, size) => Array.from(
  new Array(Math.ceil(array.length / size)),
  (_, i) => array.slice(i * size, i * size + size)
);

const purge = async (revsById) => fetchOnDb('POST', PURGE_URL, revsById);

(async () => {
  try {
    const date = await rl.question('Enter date (YYYY-MM-DD). Reports submitted at or before this date will be purged: ');
    const endDateMillis = new Date(date).getTime();
    const ids = await getDocIds(endDateMillis);
    if (!ids.length) {
      console.log(`No reports found to purge.`);
      return;
    }

    const answer = await rl.question(`Purging ${ids.length} reports. Continue? (y/N): `);
    if (answer !== 'y') {
      return;
    }

    for (const [index, batchIds] of getBatches(ids, BATCH_SIZE).entries()) {
      const startIndex = index * BATCH_SIZE;
      const endIndex = startIndex + batchIds.length;
      console.log(`Purging reports ${startIndex} - ${endIndex}...`);

      const revsById = await getDocRevsById(batchIds);
      await purge(revsById);
    }
  } finally {
    rl.close();
  }
})();
